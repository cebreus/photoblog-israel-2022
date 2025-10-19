import {
  loadDataset
} from '$lib/dataset';
import {
  loadPage
} from '$lib/pages';

/** @type {import('./$types').PageServerLoad} */
export async function load() {
  // Načti denní skupiny (IMAGES) a obsah stránky (jumbo/body) pro route 'israel-2022'
  const groups = loadDataset();
  const page = await loadPage('israel-2022');

  return {
    groups,
    page
  };
}
