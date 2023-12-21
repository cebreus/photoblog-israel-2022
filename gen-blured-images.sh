#!/bin/bash

input_dir="static/assets/israel-2022/previews-xl"
# input_dir="static/assets/israel-2022/maps-xl"
output_dir="static/assets/israel-2022/blurs"
max_image_size=1000  # Maximum file size for JPEG images (in bytes)

mkdir -p "$output_dir"

for image in "$input_dir"/*; do
    filename=$(basename "$image")
    extension="${filename##*.}"  # Get the file extension of the input image

    if [ "$extension" == "jpg" ]; then
        # If the input image is JPEG, create output file names with PNG and AVIF extensions.
        output_image="$output_dir/${filename%.jpg}.jpg" # Output image path for JPEG format
        output_image_png="$output_dir/${filename%.jpg}.png"  # Change the output file extension to PNG
        output_image_avif="$output_dir/${filename%.jpg}.avif"  # Change the output file extension to AVIF
    elif [ "$extension" == "png" ]; then
        # If the input image is already PNG, create output file names with AVIF extension.
        output_image="$output_dir/$filename" # Output image path for JPEG format
        output_image_png="$output_dir/$filename"  # Keep the output file extension as PNG (no change needed)
        output_image_avif="$output_dir/${filename%.png}.avif"  # Change the output file extension to AVIF
    else
        # For any other image formats, skip processing and continue to the next file.
        echo "Skipping $image: Unsupported image format."
        continue
    fi

    # Step 1: Resize and compress the input image to a maximum file size of 1000 bytes (for JPEG images).
    # Resize the image to have a width of 24 pixels, maintaining the aspect ratio.
    # Strip any metadata or comments from the image.
    # Adjust the -define jpeg:extent option to set the maximum file size for the JPEG image.
    # The value of $max_image_size determines the maximum size of the output JPEG image (in bytes).
    # Save the output image as a JPEG.
    # convert "$image" -resize 24x -strip -define jpeg:extent="$max_image_size" "$output_image"

    # Step 2: Convert the input image to PNG format with specific settings.
    # Resize the image to have a width of 24 pixels, maintaining the aspect ratio.
    # Reduce the color palette to 32 colors using the PNG-8 format.
    # Strip any metadata or comments from the image.
    # Adjust the -quality value to control compression level. Lower values mean more compression and smaller file size.
    # Save the output image as a PNG.
    convert "$image" -resize 24x -define png:format=png8 -strip -colors 32 -quality 50 -filter Lanczos "$output_image_png"

    # Step 3: Convert the input image to AVIF format with specific settings.
    # AVIF is a modern image format that offers better compression than both JPEG and PNG.
    # Resize the image to have a width of 24 pixels, maintaining the aspect ratio.
    # Strip any metadata or comments from the image.
    # Adjust the -quality value to control compression level. Lower values mean more compression and smaller file size.
    # Save the output image as an AVIF.
    # convert "$image" -resize 24x -strip -quality 50 "$output_image_avif"

done
