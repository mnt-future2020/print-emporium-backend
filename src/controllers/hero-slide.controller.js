import HeroSlide from "../models/HeroSlide.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
  getUrlFromPublicId,
  getPublicIdFromUrl,
} from "../utils/cloudinary-helper.js";

// Seed default slides if none exist
const seedDefaultSlides = async () => {
  try {
    const count = await HeroSlide.countDocuments();
    if (count === 0) {
      const defaultSlides = [
        {
          title: "Document Printing",
          subtitle: "Professional document printing services with fast turnaround times. Perfect for business reports, presentations, and everyday printing needs.",
          image: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=1200",
          iconName: "FileText",
          features: ["Same-day service", "Color & B/W options", "Multiple paper types"],
          order: 1,
          isActive: true
        },
        {
          title: "Business Cards",
          subtitle: "Make a lasting impression with premium business cards. High-quality printing on various card stocks with custom finishes available.",
          image: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=1200",
          iconName: "CreditCard",
          features: ["Premium card stock", "Matte or glossy finish", "Custom designs"],
          order: 2,
          isActive: true
        },
        {
          title: "Banners & Signage",
          subtitle: "Eye-catching banners and signs for events, promotions, and advertising. Durable materials suitable for indoor and outdoor use.",
          image: "https://images.unsplash.com/photo-1626785774573-4b799315345d?w=1200",
          iconName: "Printer",
          features: ["Large format printing", "Weather-resistant", "Custom sizes"],
          order: 3,
          isActive: true
        },
        {
          title: "Photo Printing",
          subtitle: "Preserve your memories with professional photo printing. From standard prints to canvas and metal, we bring your photos to life.",
          image: "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=1200",
          iconName: "Image",
          features: ["High-resolution prints", "Multiple formats", "Professional quality"],
          order: 4,
          isActive: true
        }
      ];

      // Convert images to public IDs if they were uploaded
      // But for seed, we use URLs directly which will be handled by getUrlFromPublicId helper if it's not a URL
      await HeroSlide.insertMany(defaultSlides);
      console.log("✅ Default hero slides seeded successfully");
    }
  } catch (error) {
    console.error("Error seeding default hero slides:", error);
  }
};

// Get all slides
export const getAllSlides = async (req, res) => {
  try {
    await seedDefaultSlides();

    const { activeOnly } = req.query;
    const query = {};

    if (activeOnly === "true") {
      query.isActive = true;
    }

    const slides = await HeroSlide.find(query).sort({ order: 1, createdAt: -1 });

    const slidesWithUrls = slides.map((slide) => ({
      ...slide._doc,
      image: slide.image && !slide.image.startsWith("http") ? getUrlFromPublicId(slide.image) : slide.image,
    }));

    return res.status(200).json({
      success: true,
      data: slidesWithUrls,
    });
  } catch (error) {
    console.error("Get slides error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch slides",
      error: error.message,
    });
  }
};

// Upsert a slide
export const upsertSlide = async (req, res) => {
  try {
    const {
      id,
      title,
      subtitle,
      image,
      iconName,
      features,
      ctaText,
      ctaLink,
      secondaryCtaText,
      secondaryCtaLink,
      isActive,
      order,
    } = req.body;

    if (!title || !image) {
      return res.status(400).json({
        success: false,
        message: "Title and Image are required",
      });
    }

    let existingSlide = null;
    if (id) {
      existingSlide = await HeroSlide.findById(id);
    }

    // Handle Image upload
    let uploadedImageValue = undefined;
    const imageData = typeof image === "object" && image !== null ? image.data : image;
    const imageName = typeof image === "object" && image !== null ? image.name : null;

    if (imageData && imageData.startsWith("data:image")) {
      if (existingSlide?.image && !existingSlide.image.startsWith("http")) {
        await deleteFromCloudinary(existingSlide.image);
      }

      const customPublicId = imageName ? imageName.split(".")[0] : null;
      const uploadResult = await uploadToCloudinary(
        imageData,
        "printemporium/images/hero",
        customPublicId
      );
      uploadedImageValue = uploadResult.public_id;
    } else if (typeof imageData === "string" && imageData.startsWith("http")) {
      const publicId = getPublicIdFromUrl(imageData);
      if (publicId) {
        uploadedImageValue = publicId;
      } else {
        uploadedImageValue = imageData; // Store direct URL if not a Cloudinary URL
      }
    }

    const slideData = {
      title,
      subtitle,
      iconName,
      features: Array.isArray(features) ? features : [],
      ctaText,
      ctaLink,
      secondaryCtaText,
      secondaryCtaLink,
      isActive,
      order,
    };

    if (uploadedImageValue !== undefined) {
      slideData.image = uploadedImageValue;
    }

    let slide;
    if (id) {
      slide = await HeroSlide.findByIdAndUpdate(id, slideData, {
        new: true,
        runValidators: true,
      });
    } else {
      slide = new HeroSlide(slideData);
      await slide.save();
    }

    return res.status(200).json({
      success: true,
      message: "Hero slide saved successfully",
      data: {
        ...slide._doc,
        image: slide.image && !slide.image.startsWith("http") ? getUrlFromPublicId(slide.image) : slide.image,
      },
    });
  } catch (error) {
    console.error("Save slide error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save slide",
      error: error.message,
    });
  }
};

// Delete a slide
export const deleteSlide = async (req, res) => {
  try {
    const { id } = req.params;
    const slide = await HeroSlide.findById(id);

    if (!slide) {
      return res.status(404).json({
        success: false,
        message: "Slide not found",
      });
    }

    if (slide.image && !slide.image.startsWith("http")) {
      await deleteFromCloudinary(slide.image);
    }

    await HeroSlide.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Hero slide deleted successfully",
    });
  } catch (error) {
    console.error("Delete slide error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete slide",
      error: error.message,
    });
  }
};
