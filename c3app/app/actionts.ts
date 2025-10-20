interface Section {
  title: string;
  order: number;
}

interface SectionData {
  output: string;
}

interface ReportItem {
  section: Section;
  content: SectionData;
}

export async function generateReportFromTOC(
  selectedText: string,
  onPlanReady?: (plan: Section[]) => void,
  onSectionProgress?: (currentSection: number) => void
): Promise<{ sessionId: string; report: ReportItem[] }> {
  const plannerURL = "http://localhost:5678/webhook/report/planner";
  const reporterURL = "http://localhost:5678/webhook/report/reporter";

  // Generate sessionId without external library
  const sessionId = Math.random().toString(36).substring(2, 10) + Date.now();
  const company = "BC Hydro";

  console.log("selectedText:", selectedText);

  // Send to planner
  const plannerRes = await fetch(plannerURL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: selectedText }),
  });

  if (!plannerRes.ok) throw new Error("Planner request failed");
  const plannerData = await plannerRes.json();
  console.log("Planner response:", plannerData);
  const sections: Section[] = JSON.parse(plannerData?.output || "[]");
  console.log("Sections:", sections);

  // Call the plan ready callback
  if (onPlanReady) {
    onPlanReady(sections);
  }

  const report: ReportItem[] = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    console.log("Processing section:", section);

    // Call the progress callback
    if (onSectionProgress) {
      onSectionProgress(i + 1);
    }

    let attempt = 0;
    let success = false;
    let sectionData: SectionData | null = null;

    while (attempt < 3 && !success) {
      try {
        const reporterRes = await fetch(reporterURL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            company,
            chatInput: JSON.stringify(section),
            sections: JSON.stringify(sections),
          }),
        });

        if (!reporterRes.ok) throw new Error("Non-200 response");

        sectionData = await reporterRes.json();
        success = true;
      } catch {
        attempt++;
        console.warn(`Retrying section (attempt ${attempt})`, section);
        if (attempt === 3) {
          console.error("Failed section after 3 attempts:", section);
          throw new Error("Reporter request failed after retries");
        }
      }
    }

    if (sectionData) {
      report.push({ section, content: sectionData });
    }
  }

  return { sessionId, report };
}
