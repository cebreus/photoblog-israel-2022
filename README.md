# Photoblog Israel 2022

![License](https://img.shields.io/badge/license-MIT-green)

Photoblog Israel 2022 is a unique photo blog providing users with an interactive and immersive experience. It's not just a gallery of images; it's a journey through Israel and Jordan in 2022, as seen through the lens of Jaroslav Vrana.

## Features

*   **Daily Photo Display**: Each day of the journey is represented by a collection of photos. Users can browse the days and see the images captured each day.
*   **Related Content**: Along with the photos, the blog provides related content about the places and locations captured in the images. This gives users a deeper understanding and context of their viewing images.
*   **Interactive Experience**: The blog is designed to be interactive. Users can click on images to view them in larger sizes, read the descriptions, and explore related content.
*   **Optimized for Performance**: The blog is optimized for performance despite being a photo-heavy website. Images are loaded efficiently to ensure a smooth user experience.
*   **FTP Deployment**: The project supports FTP deployment, making it easy to publish updates to the blog.
*   **Netlify Deployment**: The project supports deployment on Netlify, making it easy to publish updates to the blog.

## Installation

To get started with the project, clone the repository and install the dependencies:

```bash
git clone https://github.com/cebreus/photoblog-israel-2022.git
cd photoblog-israel-2022
pnpm i
```

Create a `.env` file in the root directory of the project, and add the following environment variables:

```env
DATA_DIR="israel-2022"
BASE_URL="https://israel-2022.cebre.us"

# Favicons
SITE_TITLE="Izrael 2022"
APP_NAME="Fotky Izrael 2022"
APP_SHORT_NAME="Foto Izrael"
APP_DESCRIPTION="Fotografické střípky z výletu do Izraele a Jordánska."
DEVELOPER_NAME="Jaroslav Vrana"
DEVELOPER_URL="https://cebre.us/"
BACKGROUND="#0a1d39"
THEME_COLOR="#0a1d39"

# FTP deployment
FTP_HOST=
FTP_USER=
FTP_PASSWORD=
```

## Usage

The project provides several npm scripts for development and building:

*   `pnpm start`: Starts the development server.
*   `pnpm build`: Builds the project.
*   `pnpm build:validate:html`: Validates the HTML of the built project.
*   `pnpm build:video`: Optimizes video files.
*   `pnpm dev`: Starts the development server.
*   `pnpm deploy-ftp`: Deploys the project via FTP.
*   `pnpm format`: Formats the codebase.
*   `pnpm release`: Creates a new release.

## Changelog

For detailed information about the changes in each update, please refer to the [CHANGELOG.md](https://github.com/cebreus/photoblog-israel-2022/blob/main/CHANGELOG.md).

## Contributing

Contributions are welcome. Please open an issue or submit a pull request.

## License

Photoblog Israel 2022 is licensed under the MIT License. See [LICENSE](https://github.com/cebreus/photoblog-israel-2022/blob/main/LICENSE) for more information.

## Contact

For any inquiries, you can reach out to Jaroslav Vrana at <cebreus@live.com>.
