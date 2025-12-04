import { promises as fs } from 'fs';
import path from 'path';
import { favicons } from 'favicons';
import matter from 'gray-matter';
import { config as projectConfig } from './config';

async function run() {
	const sourceDir = path.resolve(projectConfig.paths.source);
	const siteConfigPath = path.join(sourceDir, 'site.md');
	let sourceFile;
	let manifestConfig = {};
	let lang = 'cs-CZ'; // Initialize lang with a default value

	try {
		const siteConfigFile = await fs.readFile(siteConfigPath, 'utf8');
		const { data } = matter(siteConfigFile);

		if (data.favicon) {
			sourceFile = path.join(sourceDir, data.favicon);
		}
		if (data.manifest) {
			manifestConfig = data.manifest;
		}
		if (data.meta?.lang) { // Update lang if found in site.md
			lang = data.meta.lang;
		}
	} catch (error) {
		console.warn(`Could not read or parse ${siteConfigPath}.`, error);
	}

	if (!sourceFile) {
		console.warn(`"favicon" key not found in ${siteConfigPath}, or file is unreadable. Skipping generation.`);
		return;
	}

	try {
		await fs.access(sourceFile);
		console.log(`Using source file: ${sourceFile}`);
	} catch (error) {
		console.error(`Source file not found at path: ${sourceFile}. Please check the 'favicon' path in ${siteConfigPath}.`);
		process.exit(1);
	}

	const outDir = path.resolve('./static/assets/favicons');
	await fs.mkdir(outDir, { recursive: true });

	// Merge defaults with config from site.md
	const configuration = {
		...manifestConfig, // Spread the loaded config from site.md first
		path: '/assets/favicons/', // This should be controlled by the script's output structure
		logging: false,
		online: false,
		preferOnline: false,
		lang: lang, // Use the dynamically set lang
		icons: { // Sensible defaults for icons, can be overridden by site.md manifest config
			android: true,
			appleIcon: true,
			appleStartup: true,
			coast: false,
			favicons: true,
			firefox: false,
			windows: true,
			yandex: false,
			...(manifestConfig.icons || {}), // Allow overriding specific icons from site.md
		},
	};

	try {
		const response = await favicons(sourceFile, configuration);

		// Handle favicon.ico separately: write to static/ and remove its link from generated HTML
		const faviconIco = response.images.find((image) => image.name === 'favicon.ico');
		const faviconIcoLink = '<link rel="icon" type="image/x-icon" href="/assets/favicons/favicon.ico">';

		if (faviconIco) {
			await fs.writeFile(path.resolve('./static/favicon.ico'), faviconIco.contents);
			console.log('Wrote static/favicon.ico');
			// Remove the favicon.ico from the images array so it's not written twice to assets/favicons
			response.images = response.images.filter((image) => image.name !== 'favicon.ico');
			// Remove the corresponding link tag from HTML
			response.html = response.html.filter(
				(htmlLine) => htmlLine.trim() !== faviconIcoLink.trim(),
			);
		}

		await Promise.all(
			response.images.map(async (image) =>
				fs.writeFile(path.join(outDir, image.name), image.contents),
			),
		);
		console.log('Wrote images');

		await Promise.all(
			response.files.map(async (file) => fs.writeFile(path.join(outDir, file.name), file.contents)),
		);
		console.log('Wrote files (manifests, etc.) to assets/favicons');

		await fs.writeFile(path.join(outDir, 'favicons.html'), response.html.join('\n'));
		console.log('Wrote favicons.html to assets/favicons');

		console.log('Favicons generated successfully using dynamic config.');
	} catch (error) {
		console.error('Error during favicon generation:', error);
		process.exit(1);
	}
}

run().catch((e) => {
	console.error(e);
	process.exit(1);
});
