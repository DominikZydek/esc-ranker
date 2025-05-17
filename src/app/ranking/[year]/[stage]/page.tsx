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
    // fields for algorithm
    id: number;
    score: number;
    comparisons: number;
    uncertainty: number; // new field for ELO algorithm
};

export default function RankingPage() {
    // getting parameters from URL
    const params = useParams();
    const year = params?.year as string;
    const stage = params?.stage as string;

    // component states
    const [allEntries, setAllEntries] = useState<Entry[]>([]);
    const [currentComparison, setCurrentComparison] = useState<[Entry, Entry] | null>(null);
    const [rankedEntries, setRankedEntries] = useState<Entry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isComplete, setIsComplete] = useState(false);
    const [comparisonsMade, setComparisonsMade] = useState(0);

    // result matrix for ELO algorithm
    const [resultMatrix, setResultMatrix] = useState<number[][]>([]);

    // ELO algorithm configuration
    const ELO_BASE_K = 32; // base learning coefficient
    const INITIAL_RATING = 1400; // initial rating
    const INITIAL_UNCERTAINTY = 100; // initial uncertainty
    const MIN_UNCERTAINTY = 20; // minimum uncertainty after many comparisons

    // dynamically calculating maximum number of comparisons based on data amount
    const maxComparisons = useMemo(() => {
        const n = allEntries.length;
        if (n <= 0) return 0;

        // formulas based on number of elements:
        // - below 15 elements: 2.5n comparisons (good balance for small sets)
        // - between 15 and 30 elements: 2n comparisons (optimal for medium sets)
        // - above 30 elements: 1.8n comparisons (for large sets)
        // - minimum 10 comparisons, maximum 100 (to ensure sensible limits)

        if (n < 15) {
            return Math.min(Math.max(10, Math.round(2.5 * n)), 100);
        } else if (n < 30) {
            return Math.min(Math.max(10, Math.round(2 * n)), 100);
        } else {
            return Math.min(Math.max(10, Math.round(1.8 * n)), 100);
        }
    }, [allEntries.length]);

    // function calculating win probability in ELO model
    const calculateExpectedScore = (ratingA: number, ratingB: number): number => {
        return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    };

    // function updating ELO ranking after comparison
    const updateEloRatings = (entries: Entry[], winner: Entry, loser: Entry): Entry[] => {
        const updatedEntries = [...entries];

        // finding winner and loser indices
        const winnerIndex = entries.findIndex(e => e.id === winner.id);
        const loserIndex = entries.findIndex(e => e.id === loser.id);

        if (winnerIndex === -1 || loserIndex === -1) return entries;

        // getting current rankings
        const winnerRating = entries[winnerIndex].score;
        const loserRating = entries[loserIndex].score;

        // calculating expected results
        const expectedWinner = calculateExpectedScore(winnerRating, loserRating);
        const expectedLoser = calculateExpectedScore(loserRating, winnerRating);

        // determining dynamic K coefficient based on uncertainty and number of comparisons
        const winnerK = ELO_BASE_K * (entries[winnerIndex].uncertainty / INITIAL_UNCERTAINTY);
        const loserK = ELO_BASE_K * (entries[loserIndex].uncertainty / INITIAL_UNCERTAINTY);

        // updating rankings
        updatedEntries[winnerIndex] = {
            ...entries[winnerIndex],
            score: winnerRating + winnerK * (1 - expectedWinner),
            comparisons: entries[winnerIndex].comparisons + 1,
            // reducing uncertainty after each comparison, but never below MIN_UNCERTAINTY
            uncertainty: Math.max(
                entries[winnerIndex].uncertainty * 0.95,
                MIN_UNCERTAINTY
            )
        };

        updatedEntries[loserIndex] = {
            ...entries[loserIndex],
            score: loserRating + loserK * (0 - expectedLoser),
            comparisons: entries[loserIndex].comparisons + 1,
            // reducing uncertainty after each comparison, but never below MIN_UNCERTAINTY
            uncertainty: Math.max(
                entries[loserIndex].uncertainty * 0.95,
                MIN_UNCERTAINTY
            )
        };

        return updatedEntries;
    };

    // function selecting next pair for comparison - uses adaptive sampling
    const getNextComparison = (entries: Entry[]): [Entry, Entry] | null => {
        if (entries.length < 2) return null;

        const n = entries.length;

        // creating table of potential pairs for comparison
        const potentialPairs: Array<{
            indexA: number;
            indexB: number;
            score: number; // measure of "information value" of comparison
        }> = [];

        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const entryA = entries[i];
                const entryB = entries[j];

                // counting total number of comparisons for these elements
                const totalComparisons = entryA.comparisons + entryB.comparisons;

                // calculating ranking difference
                const ratingDiff = Math.abs(entryA.score - entryB.score);

                // calculating sum of uncertainty for both elements
                const totalUncertainty = entryA.uncertainty + entryB.uncertainty;

                // calculating win probability in ELO model
                const expectedProb = calculateExpectedScore(entryA.score, entryB.score);

                // highest information value comes from comparisons of elements:
                // 1. with similar ranking (small ranking difference)
                // 2. with high uncertainty (few comparisons)
                // 3. with non-obvious result (probability close to 0.5)

                // calculating information value of comparison (higher is better)
                // normalizing each factor to [0, 1] range and weighing their impact
                const ratingDiffScore = 1 / (1 + ratingDiff / 200); // smaller difference is better
                const uncertaintyScore = totalUncertainty / (2 * INITIAL_UNCERTAINTY); // higher uncertainty is better
                const probScore = 1 - Math.abs(expectedProb - 0.5) * 2; // closer to 0.5 is better
                const comparisonScore = 1 / (1 + totalComparisons); // fewer comparisons is better

                // combined score (with weights)
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

        // sorting pairs by information value (descending)
        potentialPairs.sort((a, b) => b.score - a.score);

        // selecting the best pair (with small element of randomness)
        // choosing from top 20% pairs or from top 3 pairs (whichever is larger)
        const topPairsCount = Math.max(3, Math.floor(potentialPairs.length * 0.2));
        const randomIndex = Math.floor(Math.random() * Math.min(topPairsCount, potentialPairs.length));
        const selectedPair = potentialPairs[randomIndex];

        if (!selectedPair) {
            // fallback - random pair
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
        // function for sending basic analytics data
        const sendPageViewAnalytics = async () => {
            try {
                // checking if at least 30 minutes have passed since last record
                const storageKey = 'eurovision-analytics-last-sent';
                const lastSentTime = localStorage.getItem(storageKey);
                const currentTime = new Date().getTime();

                // if we have a saved time of last data send
                if (lastSentTime) {
                    const lastSentTimestamp = parseInt(lastSentTime, 10);
                    const timeDiffMinutes = (currentTime - lastSentTimestamp) / (1000 * 60);

                    // if 30 minutes haven't passed yet, skip sending
                    if (timeDiffMinutes < 30) {
                        return;
                    }
                }

                // URL of Google Apps Script
                const scriptUrl = 'https://script.google.com/macros/s/AKfycbzwROpGhq76lpnR_Dk_bI4lJTWOMxyMVPg2mu6gfUKMeUphOuKNhXtvic7XxyVi5pJR/exec';

                // basic visit data
                const data = {
                    url: window.location.href,
                    timestamp: new Date().toISOString(),
                    year: year || 'unknown',
                    stage: stage || 'unknown',
                    userAgent: navigator.userAgent,
                    timeSinceLastVisit: lastSentTime ? `${Math.round((currentTime - parseInt(lastSentTime, 10)) / (1000 * 60))} min` : 'first-visit'
                };

                // sending data to Google Sheets
                fetch(scriptUrl, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data),
                });

                // saving current time as last sent time
                localStorage.setItem(storageKey, currentTime.toString());

            } catch (error) {
                console.error('Error while sending data:', error);
            }
        };

        // function for loading data
        const loadEntries = async () => {
            // check if parameters are available
            if (!year || !stage) {
                setError("Missing required parameters");
                setIsLoading(false);
                return;
            }

            setIsLoading(true);

            try {
                // dynamically importing appropriate data file
                let stageData: Omit<Entry, 'id' | 'score' | 'comparisons' | 'uncertainty'>[] = [];

                try {
                    const yearModule = await import(`@/data/years/${year}.ts`);

                    // selecting appropriate data based on contest stage
                    if (stage === "semi1" && yearModule.SEMIFINAL_1) {
                        stageData = yearModule.SEMIFINAL_1;
                    } else if (stage === "semi2" && yearModule.SEMIFINAL_2) {
                        stageData = yearModule.SEMIFINAL_2;
                    } else if (stage === "final" && yearModule.FINAL) {
                        stageData = yearModule.FINAL;
                    } else {
                        throw new Error(`No data for stage ${stage}`);
                    }

                    if (stageData.length === 0) {
                        throw new Error(`No data for year ${year} and stage ${stage}`);
                    }
                } catch (importError) {
                    throw new Error(`Data not found for year ${year}: ${(importError as Error).message}`);
                }

                // data initialization
                const initializedEntries = stageData.map((entry, index) => ({
                    ...entry,
                    id: index,
                    score: INITIAL_RATING,
                    comparisons: 0,
                    uncertainty: INITIAL_UNCERTAINTY
                }));

                setAllEntries(initializedEntries);

                // initializing results matrix
                const n = initializedEntries.length;
                const initialResultMatrix = Array(n).fill(0).map(() => Array(n).fill(0));
                setResultMatrix(initialResultMatrix);

                // selecting first comparison
                const firstComparison = getNextComparison(initializedEntries);
                setCurrentComparison(firstComparison);
                setComparisonsMade(0);

                setError(null);
            } catch (err) {
                setError(`Failed to load data: ${(err as Error).message}`);
            } finally {
                setIsLoading(false);
            }
        };

        // first sending analytics data, then loading data
        // sending data doesn't block app loading
        sendPageViewAnalytics();
        loadEntries();

    }, [year, stage]);

    const handleSelect = (winner: Entry, loser: Entry) => {
        if (!currentComparison) return;

        // updating results matrix
        const newResultMatrix = [...resultMatrix];
        newResultMatrix[winner.id][loser.id] += 1;
        setResultMatrix(newResultMatrix);

        // updating ELO rankings
        const updatedEntries = updateEloRatings(allEntries, winner, loser);
        setAllEntries(updatedEntries);

        // increasing comparison counter
        const nextComparisonCount = comparisonsMade + 1;
        setComparisonsMade(nextComparisonCount);

        // checking if we've reached maximum number of comparisons
        if (nextComparisonCount >= maxComparisons) {
            // ranking is complete
            setIsComplete(true);
            setCurrentComparison(null);

            // calculating final ranking (sorting by score - ELO rating)
            const ranked = [...updatedEntries].sort((a, b) => b.score - a.score);
            setRankedEntries(ranked);
        } else {
            // selecting next comparison
            const nextComparison = getNextComparison(updatedEntries);
            setCurrentComparison(nextComparison);

            // if there are no more possible comparisons, we end the ranking
            if (!nextComparison) {
                setIsComplete(true);
                const ranked = [...updatedEntries].sort((a, b) => b.score - a.score);
                setRankedEntries(ranked);
            }
        }
    };

    const handleReset = () => {
        // resetting state
        const n = allEntries.length;

        // resetting results matrix
        const initialResultMatrix = Array(n).fill(0).map(() => Array(n).fill(0));
        setResultMatrix(initialResultMatrix);

        // resetting elements
        const resetEntries = allEntries.map(entry => ({
            ...entry,
            score: INITIAL_RATING,
            comparisons: 0,
            uncertainty: INITIAL_UNCERTAINTY
        }));

        setAllEntries(resetEntries);

        // selecting first comparison
        const firstComparison = getNextComparison(resetEntries);
        setCurrentComparison(firstComparison);
        setComparisonsMade(0);
        setIsComplete(false);
    };

    const getStageName = () => {
        switch (stage) {
            case "semi1": return "Semifinal 1";
            case "semi2": return "Semifinal 2";
            case "final": return "Final";
            default: return "Ranking";
        }
    };

    const getProgress = () => {
        if (maxComparisons === 0) return 0;
        return Math.round((comparisonsMade / maxComparisons) * 100);
    };

    // function returning rating change for display
    const getRatingChange = (entry: Entry): string => {
        const change = Math.round(entry.score - INITIAL_RATING);
        if (change > 0) return `+${change}`;
        return `${change}`;
    };

    if (isLoading) {
        return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen px-4">
                <h1 className="text-2xl font-bold mb-4">Error</h1>
                <p>{error}</p>
                <Link
                    href="/"
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                    Return to homepage
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
                            Start over
                        </button>
                    )}
                    <Link
                        href="/"
                        className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 dark:border-gray-600"
                    >
                        Back
                    </Link>
                </div>
            </div>

            {!isComplete && currentComparison ? (
                <div className="mb-8">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
                        <h2 className="text-xl font-semibold mb-4 text-center">Which song do you prefer?</h2>

                        <div className="flex flex-col md:flex-row gap-4">
                            {/* Left option */}
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

                            {/* Right option */}
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

                    {/* Progress bar */}
                    <div className="mt-6">
                        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mb-2">
                            <div
                                className="bg-blue-600 h-2.5 rounded-full"
                                style={{ width: `${getProgress()}%` }}
                            ></div>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                            Progress: {comparisonsMade} of {maxComparisons} comparisons ({getProgress()}%)
                            <br />
                            <span className="text-xs">The number of comparisons was automatically determined based on {allEntries.length} songs</span>
                        </p>
                    </div>
                </div>
            ) : isComplete ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
                    <h2 className="text-xl font-semibold mb-4">Your ranking</h2>

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
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md text-center">
                    <p className="text-xl">No data available for comparison.</p>
                </div>
            )}
        </div>
    );
}