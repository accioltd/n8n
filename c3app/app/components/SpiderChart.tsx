"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

// NIST CSF 2.0 Category definitions
export interface NistSubcategory {
  id: string;
  name: string;
  category: string;
  value: number; // Score from 1-5
}

export interface NistCategory {
  id: string;
  name: string;
  subcategories: NistSubcategory[];
}

export interface SpiderChartProps {
  title?: string;
  data: NistCategory[];
  height?: number;
  showLegend?: boolean;
  showDataLabels?: boolean;
}

// NIST CSF 2.0 Categories with standard colors
const NIST_CATEGORIES = {
  IDENTIFY: { name: "Identify", color: "#1f77b4" },
  PROTECT: { name: "Protect", color: "#ff7f0e" },
  DETECT: { name: "Detect", color: "#2ca02c" },
  RESPOND: { name: "Respond", color: "#d62728" },
  RECOVER: { name: "Recover", color: "#9467bd" },
  GOVERN: { name: "Govern", color: "#8c564b" },
};

export const SpiderChart: React.FC<SpiderChartProps> = ({
  title,
  data,
  height = 400,
  showLegend = true,
  showDataLabels = false,
}) => {
  const chartData = useMemo(() => {
    // Transform NIST data into ApexCharts format - group subcategories by category
    const categories: string[] = [];
    const values: number[] = [];
    const colors: string[] = [];
    const categoryInfo: Array<{
      categoryName: string;
      startIndex: number;
      endIndex: number;
      color: string;
    }> = [];

    // Sort categories in NIST order: Govern, Identify, Protect, Detect, Respond, Recover
    const categoryOrder = [
      "Govern",
      "Identify",
      "Protect",
      "Detect",
      "Respond",
      "Recover",
    ];
    const sortedData = [...data].sort((a, b) => {
      const aIndex = categoryOrder.indexOf(a.name);
      const bIndex = categoryOrder.indexOf(b.name);
      return aIndex - bIndex;
    });

    let currentIndex = 0;
    sortedData.forEach((category) => {
      const startIndex = currentIndex;

      // Get the color for this category
      const nistCategoryKey = Object.keys(NIST_CATEGORIES).find(
        (key) =>
          NIST_CATEGORIES[key as keyof typeof NIST_CATEGORIES].name ===
          category.name
      );
      const categoryColor = nistCategoryKey
        ? NIST_CATEGORIES[nistCategoryKey as keyof typeof NIST_CATEGORIES].color
        : "#6b7280";

      // Add each subcategory in order
      category.subcategories.forEach((sub) => {
        categories.push(sub.id); // Use subcategory ID for the label
        values.push(sub.value); // Value should be 1-5 scale
        colors.push(categoryColor); // Use category color
        currentIndex++;
      });

      const endIndex = currentIndex - 1;
      categoryInfo.push({
        categoryName: category.name,
        startIndex,
        endIndex,
        color: categoryColor,
      });
    });

    const series = [
      {
        name: "NIST CSF 2.0 Scores",
        data: values,
      },
    ];

    return { categories, series, colors, categoryInfo };
  }, [data]);

  const chartOptions = useMemo(() => {
    const options = {
      chart: {
        type: "radar" as const,
        height: height,
        toolbar: {
          show: false,
        },
      },
      title: title
        ? {
            text: title,
            align: "center" as const,
            style: {
              fontSize: "18px",
              fontWeight: "600",
              color: "#333",
            },
          }
        : undefined,
      xaxis: {
        categories: chartData.categories,
        labels: {
          style: {
            fontSize: "12px",
            fontWeight: "500",
          },
        },
      },
      yaxis: {
        min: 0,
        max: 5,
        tickAmount: 5,
        labels: {
          formatter: (value: number) => `${value}`,
          style: {
            fontSize: "10px",
          },
        },
      },
      plotOptions: {
        radar: {
          size: 180,
          polygons: {
            strokeColors: "#e9ecef",
            strokeWidth: "1px",
            fill: {
              colors: ["#f8f9fa", "#ffffff"],
            },
          },
        },
      },
      fill: {
        type: "gradient",
        gradient: {
          shade: "light",
          type: "horizontal",
          shadeIntensity: 0.5,
          gradientToColors: chartData.colors,
          inverseColors: true,
          opacityFrom: 0.7,
          opacityTo: 0.3,
          stops: [0, 100],
        },
      },
      stroke: {
        width: 2,
        colors: chartData.colors,
      },
      markers: {
        size: 4,
        colors: chartData.colors,
        strokeColors: "#ffffff",
        strokeWidth: 2,
      },
      dataLabels: {
        enabled: showDataLabels,
        background: {
          enabled: true,
          foreColor: "#fff",
          padding: 4,
          borderRadius: 2,
          borderWidth: 1,
          borderColor: "#fff",
          opacity: 0.9,
        },
        style: {
          fontSize: "10px",
          fontWeight: "500",
        },
      },
      legend: {
        show: showLegend,
        position: "bottom" as const,
        horizontalAlign: "center" as const,
        fontSize: "12px",
        fontWeight: "500",
        markers: {
          size: 12,
        },
      },
      tooltip: {
        enabled: true,
        custom: ({
          seriesIndex,
          dataPointIndex,
          w,
        }: {
          seriesIndex: number;
          dataPointIndex: number;
          w: any;
        }) => {
          // Find the subcategory and its parent category
          let subcategoryIndex = 0;
          let parentCategory = null;
          let subcategory = null;

          for (const category of data) {
            for (const sub of category.subcategories) {
              if (subcategoryIndex === dataPointIndex) {
                parentCategory = category;
                subcategory = sub;
                break;
              }
              subcategoryIndex++;
            }
            if (subcategory) break;
          }

          if (!subcategory || !parentCategory) {
            return `<div style="padding: 8px;">No data available</div>`;
          }

          const score = w.globals.series[seriesIndex][dataPointIndex];

          let tooltipContent = `
        <div style="padding: 12px; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px; color: #1f2937;">
            ${subcategory.id}
          </div>
          <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">
            ${subcategory.name}
          </div>
          <div style="font-size: 11px; color: #9ca3af; margin-bottom: 8px;">
            Category: ${parentCategory.name}
          </div>
          <div style="font-size: 12px; color: #6b7280;">
            Score: <span style="font-weight: 600; color: #059669;">${score}/5</span>
          </div>
        </div>`;

          return tooltipContent;
        },
      },
      grid: {
        show: true,
        strokeDashArray: 3,
        padding: {
          top: 20,
          right: 30,
          bottom: 20,
          left: 30,
        },
      },
      responsive: [
        {
          breakpoint: 768,
          options: {
            plotOptions: {
              radar: {
                size: 120,
              },
            },
            legend: {
              position: "bottom",
            },
          },
        },
        {
          breakpoint: 480,
          options: {
            plotOptions: {
              radar: {
                size: 100,
              },
            },
            xaxis: {
              labels: {
                style: {
                  fontSize: "10px",
                },
              },
            },
          },
        },
      ],
    };
    return options;
  }, [chartData, title, height, showLegend, showDataLabels, data]);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No NIST CSF data available</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <ReactApexChart
        options={chartOptions}
        series={chartData.series}
        type="radar"
        height={height}
      />
    </div>
  );
};
