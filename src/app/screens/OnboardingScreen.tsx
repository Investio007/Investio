import { useState } from "react";
import { useNavigate } from "react-router";
import { BookOpen, Brain, Target, ChevronRight } from "lucide-react";
import { Button } from "../components/ui/button";

const slides = [
  {
    icon: BookOpen,
    title: "Learn About Investing",
    description: "We explain investments in simple words. Easy to understand for everyone.",
  },
  {
    icon: Brain,
    title: "AI Powered Guidance",
    description: "Our AI looks at companies and markets. It helps you make smart choices.",
  },
  {
    icon: Target,
    title: "Build Your Demo Portfolio",
    description: "Create a practice portfolio. Learn how investing works with no risk.",
  },
];

export function OnboardingScreen() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      navigate("/auth");
    }
  };

  const handleSkip = () => {
    navigate("/auth");
  };

  const slide = slides[currentSlide];
  const Icon = slide.icon;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
        <div className="w-full max-w-md flex flex-col items-center">
          {/* Illustration */}
          <div className="w-48 h-48 bg-[#F5F7FA] rounded-full flex items-center justify-center mb-12">
            <Icon className="w-24 h-24 text-[#0A1F44]" />
          </div>

          {/* Content */}
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#0A1F44] mb-4">
              {slide.title}
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              {slide.description}
            </p>
          </div>

          {/* Dots */}
          <div className="flex gap-2 mb-12">
            {slides.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all ${
                  index === currentSlide
                    ? "w-8 bg-[#0A1F44]"
                    : "w-2 bg-gray-300"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="px-8 pb-8 space-y-3">
        {/* Disclaimer */}
        {currentSlide === slides.length - 1 && (
          <div className="mb-4 p-4 bg-[#F5F7FA] rounded-2xl">
            <p className="text-xs text-[#1F2937] text-center leading-relaxed">
              Investio is an AI investment analysis platform. This app does not
              hold funds, execute trades, or manage real investments. All
              portfolio values are simulations for educational purposes.
            </p>
          </div>
        )}
        <Button
          onClick={handleNext}
          className="w-full bg-[#0A1F44] hover:bg-[#0A1F44]/90 text-white h-14 rounded-2xl text-lg"
        >
          {currentSlide < slides.length - 1 ? (
            <>
              Next <ChevronRight className="ml-2 w-5 h-5" />
            </>
          ) : (
            "Get Started"
          )}
        </Button>
        {currentSlide < slides.length - 1 && (
          <Button
            onClick={handleSkip}
            variant="ghost"
            className="w-full text-gray-500 h-14 rounded-2xl text-lg"
          >
            Skip
          </Button>
        )}
      </div>
    </div>
  );
}