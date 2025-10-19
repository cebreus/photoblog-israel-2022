import {
  loadDataset
} from '$lib/dataset';
import {
  loadPage
} from '$lib/pages';

/** @type {import('./$types').PageServerLoad} */
export async function load() {
  // Best of varianta – filtruje dataset podle keywords 'prio2'
  const groups = loadDataset({
    bestOf: true
  });
  const page = await loadPage('best-of');

  return {
    groups,
    page,
    isBestOf: true
  };
}
