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

      <div class="mt-4" data-cy="day-meta">
        <h3 class="h5 text-center mb-3">Obrázky — metainformace</h3>
        <div class="container">
          {#each group.items.filter((i) => i && i.kind === 'image') as img (img.id)}
            <details class="mb-3">
              <summary
                ><strong>{img.id}</strong> — {img.where || img.city || '—'} ({fmtDate(
                  img.date,
                )})</summary
              >

              <div class="row small mt-2">
                <div class="col-12 col-md-6">
                  <table class="table table-sm table-striped">
                    <tbody>
                      <tr><th scope="row">ID</th><td>{img.id}</td></tr>
                      <tr
                        ><th scope="row">Datum</th><td>{img.date || '—'}</td
                        ></tr
                      >
                      <tr><th scope="row">Den</th><td>{group.key}</td></tr>
                      <tr
                        ><th scope="row">Město</th><td>{img.city || '—'}</td
                        ></tr
                      >
                      <tr
                        ><th scope="row">Místo (where)</th><td
                          >{img.where || '—'}</td
                        ></tr
                      >
                      <tr><th scope="row">Typ</th><td>{img.type || '—'}</td></tr
                      >
                      <tr
                        ><th scope="row">Rozměry</th><td
                          >{img.original?.width || '—'} × {img.original
                            ?.height || '—'}</td
                        ></tr
                      >
                      <tr
                        ><th scope="row">Poměr stran</th><td>
                          {#if img.original?.width && img.original?.height}
                            {(img.original.width / img.original.height).toFixed(
                              2,
                            )}
                          {:else}—{/if}
                        </td></tr
                      >
                    </tbody>
                  </table>
                </div>

                <div class="col-12 col-md-6">
                  <table class="table table-sm table-striped">
                    <tbody>
                      <tr
                        ><th scope="row">Keywords</th><td
                          >{Array.isArray(img.meta?.keywords)
                            ? img.meta.keywords.join(', ')
                            : img.meta?.keywords || '—'}</td
                        ></tr
                      >
                      <tr
                        ><th scope="row">Caption</th><td
                          >{img.meta?.caption || '—'}</td
                        ></tr
                      >
                      <tr
                        ><th scope="row">ObjectName</th><td
                          >{img.meta?.objectName || '—'}</td
                        ></tr
                      >
                      <tr
                        ><th scope="row">Country</th><td
                          >{img.meta?.country || '—'}</td
                        ></tr
                      >
                    </tbody>
                  </table>
                </div>
              </div>

              <pre class="small bg-light p-2 border rounded"><code
                  >{JSON.stringify(
                    {
                      id: img.id,
                      date: img.date,
                      groupBy: group.key,
                      city: img.city,
                      where: img.where,
                      type: img.type,
                      size: {
                        width: img.original?.width,
                        height: img.original?.height,
                      },
                      ratio:
                        img.original?.width && img.original?.height
                          ? img.original.width / img.original.height
                          : null,
                      meta: img.meta || {},
                    },
                    null,
                    2,
                  )}</code
                ></pre>

              <!-- JSON-LD strukturovaná data pro každý snímek -->
              <script type="application/ld+json">
                {JSON.stringify({
                  "@context": "https://schema.org",
                  "@type": "Photograph",
                  "identifier": img.id,
                  "name": (img.where || img.city || img.id),
                  "dateCreated": img.date || null,
                  "contentUrl": pathDetailsJpeg(img),
                  "thumbnailUrl": pathPreviewsXXS(img) || pathPreviewsJpeg(img) || pathPreviewsXLJpeg(img),
                  "width": img.original?.width || null,
                  "height": img.original?.height || null,
                  "encodingFormat": "image/jpeg",
                  "locationCreated": (img.where || img.city) ? { "@type": "Place", "name": (img.where || img.city) } : undefined,
                  "keywords": Array.isArray(img.meta?.keywords) ? img.meta.keywords : (img.meta?.keywords ? String(img.meta.keywords).split(/[;,]\s*/).filter(Boolean) : undefined),
                  "about": img.meta?.caption || undefined
                }, null, 2)}
              </script>
            </details>
          {/each}
        </div>
      </div>
    </section>
  {/each}
</main>
