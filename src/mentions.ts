export const toolkitMentions = [
  {
    id: "toolkit:browser",
    description: "Browse pages, inspect elements and interact with the browser",
    tools:
      "browser_open, browser_tabs, browser_snapshot, browser_navigate, browser_action, browser_screenshot",
  },
  {
    id: "toolkit:web",
    description: "Search the web and read sources",
    tools: "web_search, web_fetch, http_request",
  },
  {
    id: "toolkit:documents",
    description: "Read and create documents and spreadsheets",
    tools: "read_document, write_document",
  },
  {
    id: "toolkit:code",
    description: "Read, edit and run local code",
    tools:
      "read_file, propose_edit, replace_in_file, move_file, run_code, run_command",
  },
  {
    id: "toolkit:memory",
    description: "Find and maintain saved context",
    tools: "memory",
  },
  {
    id: "toolkit:database",
    description: "Query and update databases",
    tools: "database_query",
  },
  {
    id: "toolkit:schedules",
    description:
      "Schedule bot conversations and file-change reminders while the app is open",
    tools: "list_schedules, schedule_bot, remove_schedule",
  },
  {
    id: "toolkit:email",
    description:
      "Read mail, prepare drafts and manage events through a Microsoft 365 connection",
    tools: "email, calendar",
  },
  {
    id: "toolkit:connections",
    description: "Use configured connections for authenticated HTTP requests",
    tools: "list_secrets, http_request",
  },
  {
    id: "toolkit:vision",
    description:
      "View images and browser screenshots with an image-capable model",
    tools: "view_image, browser_screenshot",
  },
];
export function requestedToolkits(text: string) {
  return toolkitMentions.filter((t) =>
    new RegExp(
      `(?:^|\\s)@toolkit(?::|\\s+)${t.id.split(":")[1]}(?=\\s|$|[.,!?])`,
      "i",
    ).test(text),
  );
}
export function requestedMcps(text: string) {
  return [
    ...new Set(
      Array.from(
        text.matchAll(/(?:^|\s)@mcp(?::|\s+)([a-z0-9]+(?:-[a-z0-9]+)*)/gi),
        (m) => m[1].toLowerCase(),
      ),
    ),
  ];
}
