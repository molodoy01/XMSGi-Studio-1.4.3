let studioAppLoadPromise: Promise<typeof import('@studio/App')> | null = null;

export function loadStudioApp() {
  studioAppLoadPromise ??= import('@studio/App');
  return studioAppLoadPromise;
}

export function preloadStudioApp() {
  const loadPromise = loadStudioApp();
  void loadPromise.catch((error: unknown) => {
    console.error('Studio app preload failed.', error);
  });
  return loadPromise;
}
