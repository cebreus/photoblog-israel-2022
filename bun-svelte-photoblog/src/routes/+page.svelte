<script>
  // @ts-nocheck
  /** @type {import('./$types').PageData} */
  export let data;

  const groups = data.groups ?? [];
  const page = data.page ?? null;

  // Helpers to pick specific variant paths by folder/format (mirrors legacy previews/details layout)
  function pickVariantPath(entry, fmt, folder) {
    const variants = (entry && entry.variants && entry.variants[fmt]) || [];
    const fldr = '/' + folder + (fmt === 'jpeg' ? '' : '-' + fmt) + '/';
    const found = variants.find((v) => (v.path || '').includes(fldr));
    return found ? found.path : undefined;
  }
  const pathPreviewsXLWebp = (e) => pickVariantPath(e, 'webp', 'previews-xl');
  const pathPreviewsXLJpeg = (e) => pickVariantPath(e, 'jpeg', 'previews-xl');
  const pathPreviewsWebp = (e) => pickVariantPath(e, 'webp', 'previews');
  const pathPreviewsJpeg = (e) => pickVariantPath(e, 'jpeg', 'previews');
  const pathPreviewsXXS = (e) =>
    pickVariantPath(e, 'jpeg', 'previews-xxs') ||
    pickVariantPath(e, 'webp', 'previews-xxs');
  const pathDetailsJpeg = (e) =>
    pickVariantPath(e, 'jpeg', 'details') ||
    pickVariantPath(e, 'webp', 'details');

  function fmtDate(d) {
    try {
      return new Intl.DateTimeFormat('cs-CZ', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
      }).format(new Date(d));
    } catch {
      return d;
    }
  }
  function weekdayCS(d) {
    try {
      return new Intl.DateTimeFormat('cs-CZ', { weekday: 'long' }).format(
        new Date(d),
      );
    } catch {
      return d;
    }
  }
  function citiesOf(group) {
    const arr = Array.from(
      new Set(
        (group.items || [])
          .filter((i) => i && i.kind === 'image' && i.city)
          .map((i) => (i.city || '').replace(/\s+/g, ' ').trim()),
      ),
    ).filter(Boolean);
    return arr;
  }
  function wheresOf(group) {
    const arr = Array.from(
      new Set(
        (group.items || [])
          .filter((i) => i && i.kind === 'image' && i.where)
          .map((i) => (i.where || '').replace(/\s+/g, ' ').trim()),
      ),
    ).filter(Boolean);
    return arr;
  }
</script>

{#if page?.jumbo}
  <article class="o-main o-main--jumbo">
    <div class="c-jumbo container">
      {#if page.jumbo.title}
        <h1 class="c-jumbo__title">{@html page.jumbo.title}</h1>
      {/if}
      {#if page.jumbo.html?.excerpt}
        <div class="c-jumbo__perex col-12 col-lg-7">
          {@html page.jumbo.html.excerpt}
        </div>
      {/if}
      {#if page.jumbo.html?.content}
        <div class="c-jumbo__content col-12 col-lg-7">
          {@html page.jumbo.html.content}
        </div>
      {/if}
    </div>
  </article>
{/if}

<main>
  {#each groups as group, groupIndex}
    <section id={'day-' + group.key}>
      <div data-cy="day-head" class="container-xl">
        <h2 class="text-center pt-5 mb-4">
          <small class="t-day-heading-small">{weekdayCS(group.key)}</small>
          {fmtDate(group.key)}
        </h2>

        <div
          data-cy="day-cities"
          class="col col-lg-9 col-xl-8 col-xxl-7 mb-3 mx-auto text-center lead"
        >
          {#each citiesOf(group) as city, i}
            {city}{#if citiesOf(group).length > 1 && i < citiesOf(group).length - 1}
              —
            {/if}
          {/each}
        </div>

        <div
          data-cy="day-where"
          class="col-sm-10 col-lg-8 col-xxl-7 mx-auto mb-5 text-center"
        >
          {#each wheresOf(group) as where, i}
            <span class="badge text-bg-light fw-normal">{where}</span>
            {#if wheresOf(group).length > 1 && i < wheresOf(group).length - 1}
              <span class="visually-hidden">&bull;</span>
            {/if}
          {/each}
        </div>
      </div>

      <div class="container-xl">
        <div
          class="c-gallery row row-cols-1 row-cols-xs-2 row-cols-lg-3 row-cols-xxl-4 g-2"
        >
          {#each group.items as it (it.id)}
            {#if it.kind === 'location'}
              <div class="c-gallery__col col">
                <div
                  class="c-gallery__pic ratio ratio-16x9 bg-secondary-subtle"
                >
                  <div class="p-4 d-flex align-items-start flex-column">
                    <div class="fs-5">{it.city}</div>
                    {it.where}
                  </div>
                </div>
              </div>
            {:else}
              <a
                class="c-gallery__col col"
                data-fancybox="gallery"
                href={pathDetailsJpeg(it)}
                aria-label="Zobraz vetší obrázek"
              >
                <picture
                  class="c-gallery__pic ratio ratio-16x9 {groupIndex === 0
                    ? 'blurred-img'
                    : ''}"
                  data-title={(it.where || '').trim()}
                >
                  {#if pathPreviewsXLWebp(it)}<source
                      media="(min-width: 576px) or (max-width: 1399px)"
                      type="image/webp"
                      srcset={pathPreviewsXLWebp(it)}
                    />{/if}
                  {#if pathPreviewsXLJpeg(it)}<source
                      media="(min-width: 576px) or (max-width: 1399px)"
                      type="image/jpeg"
                      srcset={pathPreviewsXLJpeg(it)}
                    />{/if}
                  {#if pathPreviewsWebp(it)}<source
                      media="(max-width: 575px) or (min-width: 1400px)"
                      type="image/webp"
                      srcset={pathPreviewsWebp(it)}
                    />{/if}
                  {#if pathPreviewsJpeg(it)}<source
                      media="(max-width: 575px) or (min-width: 1400px)"
                      type="image/jpeg"
                      srcset={pathPreviewsJpeg(it)}
                    />{/if}
                  <img
                    src={pathPreviewsXXS(it) ||
                      pathPreviewsJpeg(it) ||
                      pathPreviewsXLJpeg(it)}
                    loading={groupIndex === 0 ? 'eager' : 'lazy'}
                    alt={it.where || it.city || it.id}
                  />
                </picture>
              </a>
            {/if}
          {/each}
        </div>
      </div>
    </section>
  {/each}
</main>
