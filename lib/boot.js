// Résolution du storage à partir du settings chargé au boot.
// Fonction pure (createStorage injecté) pour tester la logique sans Electron.

// Pas de fallback silencieux : si notesDir n'est pas configuré, on renvoie
// null. C'est au main d'en tirer la conclusion (refuser les opérations notes:*
// tant que l'utilisateur n'a pas choisi de dossier via l'onboarding T03).
export function resolveStorage(settings, { createStorage }) {
  if (
    !settings ||
    typeof settings.notesDir !== "string" ||
    settings.notesDir.length === 0
  ) {
    return null;
  }
  return createStorage(settings.notesDir);
}
