import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-col min-h-screen px-4 py-6 md:py-12">
      {/* Hero Section */}
      <section className="flex flex-col items-center text-center mb-10">
        <div className="relative w-28 h-28 mb-6">
          <Image 
            src="/Eurovision_generic_black.png" 
            alt="Eurovision Song Contest Logo" 
            fill
            priority
            className="object-contain dark:hidden"
          />
          <Image 
            src="/Eurovision_generic_white.png" 
            alt="Eurovision Song Contest Logo" 
            fill
            priority
            className="object-contain hidden dark:block"
          />
        </div>
        <h1 className="text-3xl md:text-5xl font-bold mb-4">ESC Ranker</h1>
        <p className="text-lg md:text-xl max-w-md mx-auto mb-8">
          Rankuj swoje ulubione utwory z konkursu Eurowizji i porównuj wyniki z innymi fanami.
        </p>
        <Link 
          href="/ranking" 
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-full shadow-lg transition duration-300 mb-4 w-full md:w-auto"
        >
          Rozpocznij rankowanie
        </Link>
      </section>

      {/* Countries Section */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-6 text-center">Edycja 2025</h2>
        <div className="flex flex-wrap justify-center gap-3">
          {countries.map((country) => (
            <div 
              key={country.code} 
              className="py-2 px-4 bg-white/5 rounded-full border border-white/10 text-sm flex items-center gap-2"
            >
              <span className="flag">{country.flag}</span>
              {country.name}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-12 text-center text-sm text-foreground/60">
        <p>© 2025 ESC Ranker. Wszystkie prawa zastrzeżone.</p>
        <p className="mt-2">
          ESC Ranker nie jest oficjalnie powiązany z Konkursem Piosenki Eurowizji.
        </p>
      </footer>
    </main>
  );
}

// Lista krajów uczestniczących z flagami (emoji flag + nazwa)
const countries = [
  { name: "Norwegia", code: "NO", flag: "🇳🇴" },
  { name: "Luksemburg", code: "LU", flag: "🇱🇺" },
  { name: "Estonia", code: "EE", flag: "🇪🇪" },
  { name: "Izrael", code: "IL", flag: "🇮🇱" },
  { name: "Litwa", code: "LT", flag: "🇱🇹" },
  { name: "Hiszpania", code: "ES", flag: "🇪🇸" },
  { name: "Ukraina", code: "UA", flag: "🇺🇦" },
  { name: "Wielka Brytania", code: "GB", flag: "🇬🇧" },
  { name: "Austria", code: "AT", flag: "🇦🇹" },
  { name: "Islandia", code: "IS", flag: "🇮🇸" },
  { name: "Łotwa", code: "LV", flag: "🇱🇻" },
  { name: "Holandia", code: "NL", flag: "🇳🇱" },
  { name: "Finlandia", code: "FI", flag: "🇫🇮" },
  { name: "Włochy", code: "IT", flag: "🇮🇹" },
  { name: "Polska", code: "PL", flag: "🇵🇱" },
  { name: "Niemcy", code: "DE", flag: "🇩🇪" },
  { name: "Grecja", code: "GR", flag: "🇬🇷" },
  { name: "Armenia", code: "AM", flag: "🇦🇲" },
  { name: "Szwajcaria", code: "CH", flag: "🇨🇭" },
  { name: "Malta", code: "MT", flag: "🇲🇹" },
  { name: "Portugalia", code: "PT", flag: "🇵🇹" },
  { name: "Dania", code: "DK", flag: "🇩🇰" },
  { name: "Szwecja", code: "SE", flag: "🇸🇪" },
  { name: "Francja", code: "FR", flag: "🇫🇷" },
  { name: "San Marino", code: "SM", flag: "🇸🇲" },
  { name: "Albania", code: "AL", flag: "🇦🇱" }
];