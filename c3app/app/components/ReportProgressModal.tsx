import {
  Modal,
  Text,
  Progress,
  List,
  Alert,
  Loader,
  Flex,
  Badge,
} from "@mantine/core";
import { IconCheck, IconX, IconClock } from "@tabler/icons-react";

interface Section {
  title: string;
  order: number;
}

interface ReportProgressModalProps {
  opened: boolean;
  onClose: () => void;
  stage: "planning" | "generating" | "completed" | "error";
  plan: Section[];
  currentSection: number;
  totalSections: number;
  error?: string;
}

export function ReportProgressModal({
  opened,
  onClose,
  stage,
  plan,
  currentSection,
  totalSections,
  error,
}: ReportProgressModalProps) {
  const getProgressValue = () => {
    if (stage === "planning") return 10;
    if (stage === "generating")
      return 10 + (currentSection / totalSections) * 80;
    if (stage === "completed") return 100;
    return 0;
  };

  const getStageText = () => {
    switch (stage) {
      case "planning":
        return "Creating report plan...";
      case "generating":
        return `Generating section ${currentSection} of ${totalSections}`;
      case "completed":
        return "Report generated successfully!";
      case "error":
        return "Error generating report";
      default:
        return "";
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={stage === "completed" || stage === "error" ? onClose : () => {}}
      title="Generating Report from Table of Contents"
      size="lg"
      closeOnClickOutside={false}
      closeOnEscape={false}>
      <Flex direction="column" gap="md">
        <Progress
          value={getProgressValue()}
          size="lg"
          color={
            stage === "error" ? "red" : stage === "completed" ? "green" : "blue"
          }
          animated={stage === "generating"}
        />

        <Text size="lg" fw={500}>
          {getStageText()}
        </Text>

        {stage === "error" && error && (
          <Alert icon={<IconX size="1rem" />} color="red">
            {error}
          </Alert>
        )}

        {stage === "completed" && (
          <Alert icon={<IconCheck size="1rem" />} color="green">
            Report has been generated and loaded into the editor!
          </Alert>
        )}

        {(stage === "planning" ||
          stage === "generating" ||
          stage === "completed") &&
          plan.length > 0 && (
            <>
              <Text size="md" fw={500} mt="md">
                Report Plan:
              </Text>
              <List spacing="xs" size="sm">
                {plan.map((section, index) => {
                  const isCompleted = stage === "completed";
                  const isDone = currentSection > index + 1;
                  const isCurrent =
                    currentSection === index + 1 && stage === "generating";

                  return (
                    <List.Item
                      key={index}
                      icon={
                        isCompleted || isDone ? (
                          <IconCheck size="1rem" color="green" />
                        ) : isCurrent ? (
                          <Loader size="xs" />
                        ) : (
                          <IconClock size="1rem" color="gray" />
                        )
                      }>
                      <Flex align="center" gap="xs">
                        <Text>{section.title}</Text>
                        {isCompleted && (
                          <Badge size="xs" color="green">
                            Done
                          </Badge>
                        )}
                        {isDone && stage === "generating" && (
                          <Badge size="xs" color="green">
                            Done
                          </Badge>
                        )}
                        {isCurrent && (
                          <Badge size="xs" color="blue">
                            Generating...
                          </Badge>
                        )}
                      </Flex>
                    </List.Item>
                  );
                })}
              </List>
            </>
          )}

        {stage === "planning" && (
          <Flex align="center" gap="xs" mt="md">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              Analyzing content and creating sections...
            </Text>
          </Flex>
        )}
      </Flex>
    </Modal>
  );
}
