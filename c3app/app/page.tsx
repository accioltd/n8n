import { Box } from "@mantine/core";
import Editor from "./tiptap/Editor";
import { Suspense } from "react";

// This page runs on the server side
export default async function Page() {
  return (
    <Box p={40}>
      <Suspense fallback={<div>Loading editor...</div>}>
        {/* This component is client side, inside a server component */}
        <Editor />
      </Suspense>
    </Box>
  );
}
