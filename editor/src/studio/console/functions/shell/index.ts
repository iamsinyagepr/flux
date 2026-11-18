// flux dev's stand-in for Studio's console shell (upskaleapp/src/console/
// functions/shell): the editors only ask it what an editor's back link says.
// The real one reaches into the console's own API, which stays in Studio.
export function useEditorBack(): { label: string } {
  return { label: "Back" };
}
