"use client";

import React, { useState, Suspense } from "react";
import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import dynamic from "next/dynamic";
import { createCustomNode } from "../CustomNode";

const ApexCharts = dynamic(() => import("react-apexcharts"), { ssr: false });

const name = "ChartNistCategory";

function ChartNistCategory() {
  const [categoriesData] = useState<{ category: string; avg: number }[]>([]);
  const [categories] = useState<string[]>([]);

  const options = {
    chart: { type: "radar" as const },
    xaxis: { categories },
  };

  const series = [
    { name: "Category Averages", data: categoriesData.map((item) => item.avg) },
  ];

  return (
    <NodeViewWrapper>
      <Suspense fallback={<div>Loading Chart...</div>}>
        <ApexCharts
          options={options}
          series={series}
          type="radar"
          height={350}
        />
      </Suspense>
      <NodeViewContent as="div" />
    </NodeViewWrapper>
  );
}

export const ChartNistCategoryNode = createCustomNode({
  name,
  CustomNodeView: ChartNistCategory,
});
