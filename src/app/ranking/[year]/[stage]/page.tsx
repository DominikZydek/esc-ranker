'use client'

import { useParams } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

type Entry = {
    year: number;
    country: string;
    countryEmoji: string;
    artist: string;
    title: string;
    // Pola do algorytmu
    id: number;
    score: number;
    comparisons: number;
    uncertainty: number; // Nowe pole dla algorytmu ELO
};

export default function RankingPage() {
    // Pobieranie parametrów z URL
    const params = useParams();
    const year = params?.year as string;
    const stage = params?.stage as string;

    // Stany komponentu
    const [allEntries, setAllEntries] = useState<Entry[]>([]);
    const [currentComparison, setCurrentComparison] = useState<[Entry, Entry] | null>(null);
    const [rankedEntries, setRankedEntries] = useState<Entry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isComplete, setIsComplete] = useState(false);
    const [comparisonsMade, setComparisonsMade] = useState(0);

    // Macierz wyników dla algorytmu ELO
    const [resultMatrix, setResultMatrix] = useState<number[][]>([]);

    // Konfiguracja algorytmu ELO
    const ELO_BASE_K = 32; // Podstawowy współczynnik uczenia
    const INITIAL_RATING = 1400; // Początkowy rating
    const INITIAL_UNCERTAINTY = 100; // Początkowa niepewność
    const MIN_UNCERTAINTY = 20; // Minimalna niepewność po wielu porównaniach

    // Dynamiczne obliczanie maksymalnej liczby porównań na podstawie ilości danych
    const maxComparisons = useMemo(() => {
        const n = allEntries.length;
        if (n <= 0) return 0;

        // Formuły na podstawie liczby elementów:
        // - Poniżej 15 elementów: 2.5n porównań (daje dobry balans dla małych zbiorów)
        // - Między 15 a 30 elementów: 2n porównań (optymalne dla średnich zbiorów)
        // - Powyżej 30 elementów: 1.8n porównań (dla dużych zbiorów)
        // - Minimum 10 porównań, maksimum 100 (aby zapewnić sensowne granice)

        if (n < 15) {
            return Math.min(Math.max(10, Math.round(2.5 * n)), 100);
        } else if (n < 30) {
            return Math.min(Math.max(10, Math.round(2 * n)), 100);
        } else {
            return Math.min(Math.max(10, Math.round(1.8 * n)), 100);
        }
    }, [allEntries.length]);

    console.log("Parametry URL:", { year, stage });

    // Funkcja obliczająca prawdopodobieństwo wygranej w modelu ELO
    const calculateExpectedScore = (ratingA: number, ratingB: number): number => {
        return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    };

    // Funkcja aktualizująca ranking ELO po porównaniu
    const updateEloRatings = (entries: Entry[], winner: Entry, loser: Entry): Entry[] => {
        const updatedEntries = [...entries];
        
        // Znajdujemy indeksy zwycięzcy i przegranego
        const winnerIndex = entries.findIndex(e => e.id === winner.id);
        const loserIndex = entries.findIndex(e => e.id === loser.id);
        
        if (winnerIndex === -1 || loserIndex === -1) return entries;
        
        // Pobieramy aktualne rankingi
        const winnerRating = entries[winnerIndex].score;
        const loserRating = entries[loserIndex].score;
        
        // Obliczamy oczekiwane wyniki
        const expectedWinner = calculateExpectedScore(winnerRating, loserRating);
        const expectedLoser = calculateExpectedScore(loserRating, winnerRating);
        
        // Określamy dynamiczny współczynnik K na podstawie niepewności i liczby porównań
        const winnerK = ELO_BASE_K * (entries[winnerIndex].uncertainty / INITIAL_UNCERTAINTY);
        const loserK = ELO_BASE_K * (entries[loserIndex].uncertainty / INITIAL_UNCERTAINTY);
        
        // Aktualizujemy rankingi
        updatedEntries[winnerIndex] = {
            ...entries[winnerIndex],
            score: winnerRating + winnerK * (1 - expectedWinner),
            comparisons: entries[winnerIndex].comparisons + 1,
            // Zmniejszamy niepewność po każdym porównaniu, ale nigdy poniżej MIN_UNCERTAINTY
            uncertainty: Math.max(
                entries[winnerIndex].uncertainty * 0.95, 
                MIN_UNCERTAINTY
            )
        };
        
        updatedEntries[loserIndex] = {
            ...entries[loserIndex],
            score: loserRating + loserK * (0 - expectedLoser),
            comparisons: entries[loserIndex].comparisons + 1,
            // Zmniejszamy niepewność po każdym porównaniu, ale nigdy poniżej MIN_UNCERTAINTY
            uncertainty: Math.max(
                entries[loserIndex].uncertainty * 0.95, 
                MIN_UNCERTAINTY
            )
        };
        
        return updatedEntries;
    };

    // Funkcja wybierająca następną parę do porównania - wykorzystuje adaptacyjne próbkowanie
    const getNextComparison = (entries: Entry[]): [Entry, Entry] | null => {
        if (entries.length < 2) return null;
        
        const n = entries.length;
        
        // Tworzymy tabelę potencjalnych par do porównania
        let potentialPairs: Array<{
            indexA: number;
            indexB: number;
            score: number; // Miara "wartości informacyjnej" porównania
        }> = [];
        
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const entryA = entries[i];
                const entryB = entries[j];
                
                // Liczymy całkowitą liczbę porównań tych elementów
                const totalComparisons = entryA.comparisons + entryB.comparisons;
                
                // Obliczamy różnicę w rankingu
                const ratingDiff = Math.abs(entryA.score - entryB.score);
                
                // Obliczamy sumę niepewności obu elementów
                const totalUncertainty = entryA.uncertainty + entryB.uncertainty;
                
                // Obliczamy prawdopodobieństwo wygranej w modelu ELO
                const expectedProb = calculateExpectedScore(entryA.score, entryB.score);
                
                // Największą wartość informacyjną mają porównania elementów:
                // 1. O podobnym rankingu (mała różnica w rankingu)
                // 2. Z dużą niepewnością (mało porównań)
                // 3. Z nieoczywistym wynikiem (prawdopodobieństwo bliskie 0.5)
                
                // Obliczamy wartość informacyjną porównania (im większa, tym lepiej)
                // Normalizujemy każdy czynnik do przedziału [0, 1] i ważymy ich wpływ
                const ratingDiffScore = 1 / (1 + ratingDiff / 200); // Im mniejsza różnica, tym lepiej
                const uncertaintyScore = totalUncertainty / (2 * INITIAL_UNCERTAINTY); // Im większa niepewność, tym lepiej
                const probScore = 1 - Math.abs(expectedProb - 0.5) * 2; // Im bliżej 0.5, tym lepiej
                const comparisonScore = 1 / (1 + totalComparisons); // Im mniej porównań, tym lepiej
                
                // Łączny wynik (z wagami)
                const informationValue = (
                    ratingDiffScore * 0.3 + 
                    uncertaintyScore * 0.3 + 
                    probScore * 0.2 + 
                    comparisonScore * 0.2
                );
                
                potentialPairs.push({
                    indexA: i,
                    indexB: j,
                    score: informationValue
                });
            }
        }
        
        // Sortujemy pary według wartości informacyjnej (malejąco)
        potentialPairs.sort((a, b) => b.score - a.score);
        
        // Wybieramy najlepszą parę (z niewielkim elementem losowości)
        // Wybieramy z top 20% par lub z top 3 par (cokolwiek jest większe)
        const topPairsCount = Math.max(3, Math.floor(potentialPairs.length * 0.2));
        const randomIndex = Math.floor(Math.random() * Math.min(topPairsCount, potentialPairs.length));
        const selectedPair = potentialPairs[randomIndex];
        
        if (!selectedPair) {
            // Fallback - losowa para
            const i = Math.floor(Math.random() * n);
            let j;
            do {
                j = Math.floor(Math.random() * n);
            } while (i === j);
            
            return [entries[i], entries[j]];
        }
        
        return [entries[selectedPair.indexA], entries[selectedPair.indexB]];
    };

    useEffect(() => {
        const loadEntries = async () => {
            // Sprawdź, czy parametry są dostępne
            if (!year || !stage) {
                console.error("Brak parametrów year lub stage");
                setError("Brak wymaganych parametrów");
                setIsLoading(false);
                return;
            }

            console.log("Rozpoczynam ładowanie danych dla:", year, stage);
            setIsLoading(true);

            try {
                // Dynamicznie importujemy odpowiedni plik z danymi
                let stageData: Omit<Entry, 'id' | 'score' | 'comparisons' | 'uncertainty'>[] = [];

                try {
                    console.log(`Próbuję zaimportować plik: @/data/years/${year}.ts`);
                    const yearModule = await import(`@/data/years/${year}.ts`);
                    console.log("Zaimportowano moduł, dostępne eksporty:", Object.keys(yearModule));

                    // Wybieramy odpowiednie dane na podstawie etapu konkursu
                    if (stage === "semi1" && yearModule.SEMIFINAL_1) {
                        console.log("Znaleziono dane dla półfinału 1");
                        stageData = yearModule.SEMIFINAL_1;
                    } else if (stage === "semi2" && yearModule.SEMIFINAL_2) {
                        console.log("Znaleziono dane dla półfinału 2");
                        stageData = yearModule.SEMIFINAL_2;
                    } else if (stage === "final" && yearModule.FINAL) {
                        console.log("Znaleziono dane dla finału");
                        stageData = yearModule.FINAL;
                    } else {
                        console.warn(`Nie znaleziono danych dla etapu: ${stage}`);
                        throw new Error(`Brak danych dla etapu ${stage}`);
                    }

                    console.log("Pobrane dane, liczba elementów:", stageData.length);

                    if (stageData.length === 0) {
                        throw new Error(`Brak danych dla roku ${year} i etapu ${stage}`);
                    }
                } catch (importError) {
                    console.error("Błąd importu:", importError);
                    throw new Error(`Nie znaleziono danych dla roku ${year}: ${(importError as Error).message}`);
                }

                // Inicjalizujemy dane z ID i początkowym ratingiem ELO
                const initializedEntries = stageData.map((entry, index) => ({
                    ...entry,
                    id: index,
                    score: INITIAL_RATING,
                    comparisons: 0,
                    uncertainty: INITIAL_UNCERTAINTY
                }));

                setAllEntries(initializedEntries);

                // Inicjalizujemy macierz wyników
                const n = initializedEntries.length;
                const initialResultMatrix = Array(n).fill(0).map(() => Array(n).fill(0));
                setResultMatrix(initialResultMatrix);

                // Wybieramy pierwsze porównanie
                const firstComparison = getNextComparison(initializedEntries);
                setCurrentComparison(firstComparison);
                setComparisonsMade(0);

                setError(null);
            } catch (err) {
                console.error("Błąd podczas ładowania danych:", err);
                setError(`Nie udało się załadować danych: ${(err as Error).message}`);
            } finally {
                setIsLoading(false);
            }
        };

        loadEntries();
    }, [year, stage]);

    const handleSelect = (winner: Entry, loser: Entry) => {
        if (!currentComparison) return;

        // Aktualizujemy macierz wyników
        const newResultMatrix = [...resultMatrix];
        newResultMatrix[winner.id][loser.id] += 1;
        setResultMatrix(newResultMatrix);

        // Aktualizujemy rankingi ELO
        const updatedEntries = updateEloRatings(allEntries, winner, loser);
        setAllEntries(updatedEntries);

        // Zwiększamy licznik porównań
        const nextComparisonCount = comparisonsMade + 1;
        setComparisonsMade(nextComparisonCount);

        // Sprawdzamy, czy osiągnęliśmy maksymalną liczbę porównań
        if (nextComparisonCount >= maxComparisons) {
            // Ranking jest ukończony
            setIsComplete(true);
            setCurrentComparison(null);

            // Obliczamy ostateczny ranking (sortowanie po score - ratingu ELO)
            const ranked = [...updatedEntries].sort((a, b) => b.score - a.score);
            setRankedEntries(ranked);
        } else {
            // Wybieramy następne porównanie
            const nextComparison = getNextComparison(updatedEntries);
            setCurrentComparison(nextComparison);

            // Jeśli nie ma więcej możliwych porównań, kończymy ranking
            if (!nextComparison) {
                setIsComplete(true);
                const ranked = [...updatedEntries].sort((a, b) => b.score - a.score);
                setRankedEntries(ranked);
            }
        }
    };

    const handleReset = () => {
        // Resetujemy stan
        const n = allEntries.length;

        // Resetujemy macierz wyników
        const initialResultMatrix = Array(n).fill(0).map(() => Array(n).fill(0));
        setResultMatrix(initialResultMatrix);

        // Resetujemy elementy
        const resetEntries = allEntries.map(entry => ({
            ...entry,
            score: INITIAL_RATING,
            comparisons: 0,
            uncertainty: INITIAL_UNCERTAINTY
        }));

        setAllEntries(resetEntries);

        // Wybieramy pierwsze porównanie
        const firstComparison = getNextComparison(resetEntries);
        setCurrentComparison(firstComparison);
        setComparisonsMade(0);
        setIsComplete(false);
    };

    const getStageName = () => {
        switch (stage) {
            case "semi1": return "Półfinał 1";
            case "semi2": return "Półfinał 2";
            case "final": return "Finał";
            default: return "Ranking";
        }
    };

    const getProgress = () => {
        if (maxComparisons === 0) return 0;
        return Math.round((comparisonsMade / maxComparisons) * 100);
    };

    // Funkcja zwracająca zmianę rankingu dla wyświetlenia
    const getRatingChange = (entry: Entry): string => {
        const change = Math.round(entry.score - INITIAL_RATING);
        if (change > 0) return `+${change}`;
        return `${change}`;
    };

    if (isLoading) {
        return <div className="flex items-center justify-center min-h-screen">Ładowanie...</div>;
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen px-4">
                <h1 className="text-2xl font-bold mb-4">Błąd</h1>
                <p>{error}</p>
                <Link
                    href="/"
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                    Powrót do strony głównej
                </Link>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">
                    Ranking: {getStageName()} {year}
                </h1>
                <div className="flex space-x-2">
                    {isComplete && (
                        <button
                            onClick={handleReset}
                            className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 dark:border-gray-600"
                        >
                            Zacznij od nowa
                        </button>
                    )}
                    <Link
                        href="/"
                        className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 dark:border-gray-600"
                    >
                        Powrót
                    </Link>
                </div>
            </div>

            {!isComplete && currentComparison ? (
                <div className="mb-8">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
                        <h2 className="text-xl font-semibold mb-4 text-center">Który utwór wolisz?</h2>

                        <div className="flex flex-col md:flex-row gap-4">
                            {/* Lewa opcja */}
                            <button
                                onClick={() => handleSelect(currentComparison[0], currentComparison[1])}
                                className="flex-1 border rounded-lg p-6 hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors flex flex-col items-center text-center"
                            >
                                <div className="text-5xl mb-2">{currentComparison[0].countryEmoji}</div>
                                <h3 className="text-xl font-bold mb-1">{currentComparison[0].country}</h3>
                                <p className="text-lg mb-2">{currentComparison[0].artist}</p>
                                <p className="text-gray-600 dark:text-gray-400">{currentComparison[0].title}</p>
                            </button>

                            <div className="flex items-center justify-center">
                                <span className="text-2xl font-bold">VS</span>
                            </div>

                            {/* Prawa opcja */}
                            <button
                                onClick={() => handleSelect(currentComparison[1], currentComparison[0])}
                                className="flex-1 border rounded-lg p-6 hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors flex flex-col items-center text-center"
                            >
                                <div className="text-5xl mb-2">{currentComparison[1].countryEmoji}</div>
                                <h3 className="text-xl font-bold mb-1">{currentComparison[1].country}</h3>
                                <p className="text-lg mb-2">{currentComparison[1].artist}</p>
                                <p className="text-gray-600 dark:text-gray-400">{currentComparison[1].title}</p>
                            </button>
                        </div>
                    </div>

                    {/* Pasek postępu */}
                    <div className="mt-6">
                        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mb-2">
                            <div
                                className="bg-blue-600 h-2.5 rounded-full"
                                style={{ width: `${getProgress()}%` }}
                            ></div>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                            Postęp: {comparisonsMade} z {maxComparisons} porównań ({getProgress()}%)
                            <br />
                            <span className="text-xs">Liczba porównań została dobrana automatycznie na podstawie {allEntries.length} utworów</span>
                        </p>
                    </div>
                </div>
            ) : isComplete ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
                    <h2 className="text-xl font-semibold mb-4">Twój ranking</h2>

                    <div className="space-y-4">
                        {rankedEntries.map((entry, index) => (
                            <div
                                key={`ranked-${entry.country}`}
                                className="flex items-center p-3 border-b last:border-b-0"
                            >
                                <span className="text-xl font-bold w-8 text-center">{index + 1}</span>
                                <span className="text-2xl mx-4">{entry.countryEmoji}</span>
                                <div className="flex-1">
                                    <h3 className="font-semibold">{entry.country}</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">{entry.artist} - {entry.title}</p>
                                </div>
                                <div className="text-gray-500 dark:text-gray-400 text-sm flex flex-col items-end">
                                    <div>ELO: {Math.round(entry.score)}</div>
                                    <div className={entry.score > INITIAL_RATING ? "text-green-600" : "text-red-600"}>
                                        ({getRatingChange(entry)})
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 text-sm text-gray-600 dark:text-gray-400 text-center">
                        Ranking został utworzony na podstawie {comparisonsMade} porównań z użyciem
                        systemu rankingowego ELO z adaptacyjnym próbkowaniem
                    </div>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md text-center">
                    <p className="text-xl">Brak dostępnych danych do porównania.</p>
                </div>
            )}
        </div>
    );
}