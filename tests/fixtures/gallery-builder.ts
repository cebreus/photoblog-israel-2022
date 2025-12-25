import type {
  AnalysisManifest,
  EmbeddingsManifest,
  FacesManifest,
  ImageEntry,
  Manifest,
  PeopleManifest,
  Person,
  PhotoDay,
} from "../../shared/types/manifest";

/**
 * Builder for generating consistent test data across all manifest types.
 * Helps verify "Split & Link" architecture integrity.
 */
export class GalleryBuilder {
  private images: ImageEntry[] = [];
  private faces: FacesManifest = {};
  private analysis: AnalysisManifest = {};
  private embeddings: EmbeddingsManifest = {};
  private people: Person[] = [];

  constructor(private galleryId: string = "test-gallery") {}

  /**
   * Add a photo to the gallery
   */
  addPhoto(id: string, options: Partial<Omit<ImageEntry, "id" | "type" | "src">> = {}): this {
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
      this.analysis[id] = options.analysis;
    }

    this.images.push(entry);
    return this;
  }

  /**
   * Add a detected face to a photo
   */
  addFace(
    photoId: string,
    personId: string | null,
    box: { x: number; y: number; width: number; height: number },
  ): this {
    if (!this.faces[photoId]) {
      this.faces[photoId] = {
        facesDetected: true,
        faces: [],
        peopleIds: [],
        descriptors: [],
      };
    }

    this.faces[photoId].faces.push(box);

    if (personId) {
      if (!this.faces[photoId].peopleIds.includes(personId)) {
        this.faces[photoId].peopleIds.push(personId);
      }

      // Also ensure photo links to person in ImageEntry (legacy)
      const photo = this.images.find((p) => p.id === photoId);
      if (photo) {
        if (!photo.people) photo.people = [];
        if (!photo.people.includes(personId)) photo.people.push(personId);
      }
    }

    return this;
  }

  /**
   * Add a person definition
   */
  addPerson(id: string, name: string): this {
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
    this.people.push(person);
    return this;
  }

  /**
   * Build all manifests
   */
  build() {
    // Group images by date for basic PhotoDay structure
    const photoDays: PhotoDay[] = [
      {
        date: "2025-01-01",
        id: "day-1",
        items: this.images,
      },
    ];

    const manifest: Manifest = {
      photoDays,
    };

    const peopleManifest: PeopleManifest = {
      people: this.people,
    };

    return {
      manifest, // images.manifest.json structure (wrapped)
      facesManifest: this.faces,
      analysisManifest: this.analysis,
      embeddingsManifest: this.embeddings,
      peopleManifest,
    };
  }
}
