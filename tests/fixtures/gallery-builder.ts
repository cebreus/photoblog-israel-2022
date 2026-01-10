import type {
  AnalysisManifest,
  EmbeddingsManifest,
  FacesManifest,
  ImageEntry,
  Manifest,
  PeopleManifest,
  Person,
  PhotoDay,
} from "$shared/types/manifest";

/**
 * Builder for generating consistent test data across all manifest types.
 * Helps verify "Split & Link" architecture integrity.
 */
export function createGalleryBuilder() {
  let images: ImageEntry[] = [];
  let faces: FacesManifest = {};
  let analysis: AnalysisManifest = {};
  let embeddings: EmbeddingsManifest = {};
  let people: Person[] = [];

  /**
   * Add a photo to the gallery
   */
  function addPhoto(id: string, options: Partial<Omit<ImageEntry, "id" | "type" | "src">> = {}) {
    const entry: ImageEntry = {
      id,
      type: "image",
      src: `/images/${id}.jpg`,
      alt: `Photo ${id}`,
      title: `Photo ${id}`,
      width: 800,
      height: 600,
      sources: [
        {
          variant: "default",
          type: "image/jpeg",
          path: `/images/${id}.jpg`,
          width: 800,
          height: 600,
        },
      ],
      ...options,
    };

    if (options.analysis) {
      analysis[id] = options.analysis;
    }

    images.push(entry);
    return self;
  }

  /**
   * Add a detected face to a photo
   */
  function addFace(
    photoId: string,
    personId: string | null,
    box: { x: number; y: number; width: number; height: number },
  ) {
    if (!faces[photoId]) {
      faces[photoId] = {
        facesDetected: true,
        faces: [],
        peopleIds: [],
        descriptors: [],
      };
    }

    faces[photoId].faces.push(box);

    if (personId) {
      if (!faces[photoId].peopleIds.includes(personId)) {
        faces[photoId].peopleIds.push(personId);
      }

      // Also ensure photo links to person in ImageEntry (legacy)
      function findById(p: ImageEntry) {
        return p.id === photoId;
      }
      const photo = images.find(findById);
      if (photo) {
        if (!photo.people) photo.people = [];
        if (!photo.people.includes(personId)) photo.people.push(personId);
      }
    }

    return self;
  }

  /**
   * Add a person definition
   */
  function addPerson(id: string, name: string) {
    const person: Person = {
      id,
      name,
      faceDescriptor: [],
      clusters: [],
      faceCount: 0,
      thumbnail: "",
      hidden: false,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    };
    people.push(person);
    return self;
  }

  /**
   * Build all manifests
   */
  function build() {
    // Group images by date for basic PhotoDay structure
    const photoDays: PhotoDay[] = [
      {
        date: "2025-01-01",
        id: "day-1",
        items: images,
      },
    ];

    const manifest: Manifest = {
      photoDays,
    };

    const peopleManifest: PeopleManifest = {
      people: people,
    };

    return {
      manifest, // images.manifest.json structure (wrapped)
      facesManifest: faces,
      analysisManifest: analysis,
      embeddingsManifest: embeddings,
      peopleManifest,
    };
  }

  const self = {
    addPhoto,
    addFace,
    addPerson,
    build,
  };

  return self;
}
