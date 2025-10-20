"use client";

import React from "react";
import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import { createCustomNode } from "../CustomNode";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const name = "ChartIdentify";

function ChartIdentify() {
  const series = [
    {
      name: "Practices",
      data: [
        { x: "Practice 1", y: 10 },
        { x: "Practice 2", y: 20 },
        { x: "Practice 3", y: 30 },
        { x: "Practice 4", y: 40 },
        { x: "Practice 5", y: 50 },
      ],
    },
  ];

  const options: ApexOptions = {
    chart: { type: "treemap" },
    colors: ["#ffcccc", "#ff9999", "#ff6666", "#ff3333", "#ff0000"],
    dataLabels: {
      enabled: true,
      formatter: function (val, opts) {
        return `${opts.w.globals.labels[opts.dataPointIndex]}: ${val}`;
      },
      style: { colors: ["#000"] },
    },
    title: {
      text: "Identify Practices",
      align: "center",
    },
  };

  return (
    <NodeViewWrapper>
      <div contentEditable={false}>
        <Chart options={options} series={series} type="treemap" height="500" />
      </div>
      <div>
        <h3>Your comments (editable)</h3>
        <NodeViewContent as="div" contentEditable={true} />
      </div>
    </NodeViewWrapper>
  );
}

export const ChartIdentifyNode = createCustomNode({
  name,
  CustomNodeView: ChartIdentify,
});
