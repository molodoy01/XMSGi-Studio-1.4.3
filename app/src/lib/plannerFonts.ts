const plannerFontWeights = [400, 500, 600, 700] as const;
const plannerFontSample = 'Quick Planner Планер';

export function preloadPlannerFonts(fontSet: Pick<FontFaceSet, 'load'> = document.fonts): Promise<void> {
  return Promise.all(
    plannerFontWeights.map((weight) => fontSet.load(`${weight} 14px "Exo 2"`, plannerFontSample)),
  ).then(() => undefined);
}
