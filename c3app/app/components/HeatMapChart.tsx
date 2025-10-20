"use client";

import React from "react";

type HeatMapChartProps = {
  title?: string;
  series: {
    name: string; // Function key (e.g. "GV")
    data: { x: string; y: number }[]; // x = category ID, y = score
  }[];
};

const colorScale = [
  { from: 1.0, to: 1.9, color: "bg-red-500" },
  { from: 2.0, to: 2.9, color: "bg-orange-400" },
  { from: 3.0, to: 3.9, color: "bg-yellow-300" },
  { from: 4.0, to: 4.5, color: "bg-lime-300" },
  { from: 4.6, to: 5.0, color: "bg-green-500" },
];

const getColor = (score: number) => {
  const match = colorScale.find(({ from, to }) => score >= from && score <= to);
  return match ? match.color : "bg-gray-300";
};

const functionLabels: Record<string, string> = {
  GV: "Govern",
  ID: "Identify",
  PR: "Protect",
  DE: "Detect",
  RS: "Respond",
  RC: "Recover",
};

export default function HeatMapChart({ title, series }: HeatMapChartProps) {
  return (
    <div className="p-4 space-y-6">
      {title && <h1 className="text-2xl font-bold">{title}</h1>}

      <div className="grid auto-rows-auto grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {series.map(({ name, data }) => (
          <div
            key={name}
            className="rounded-xl border border-black bg-white overflow-hidden flex flex-col">
            <div className="bg-gray-100 text-black text-md font-semibold px-4 py-2 border-b border-black">
              {functionLabels[name] || name}
            </div>
            <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-2">
              {data.map(({ x, y }) => (
                <div
                  key={x}
                  className={`text-white rounded-md px-2 py-1 text-sm font-medium ${getColor(
                    y
                  )}`}>
                  <div>{x}</div>
                  <div className="text-xs font-normal">
                    Score: {y.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
