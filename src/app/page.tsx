"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedStage, setSelectedStage] = useState("final");
  const [availableYears, setAvailableYears] = useState(["2025"]);

  useEffect(() => {
    async function fetchAvailableYears() {
      try {
        const response = await fetch('/api/available-years');
        const data = await response.json();
        if (data.years && data.years.length > 0) {
          setAvailableYears(data.years);
          setSelectedYear(data.years[0]);
        }
      } catch (error) {
        console.error('Error fetching years:', error);
      }
    }

    fetchAvailableYears();
  }, []);

  const toggleModal = () => {
    setIsModalOpen(!isModalOpen);
  }


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
        <button
          onClick={toggleModal}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-full shadow-lg transition duration-300 mb-4 w-full md:w-auto"
        >
          Rozpocznij rankowanie
        </button>
      </section>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl">
            <h2 className="text-xl font-bold mb-4">Wybierz opcje rankingu</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Rok
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Etap konkursu
              </label>
              <select
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value)}
                className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="semi1">Półfinał 1</option>
                <option value="semi2">Półfinał 2</option>
                <option value="final">Finał</option>
              </select>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={toggleModal}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Anuluj
              </button>
              <Link
                href={`/ranking/${selectedYear}/${selectedStage}`}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 inline-flex items-center justify-center"
              >
                Rozpocznij
              </Link>
            </div>
          </div>
        </div>
      )}

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