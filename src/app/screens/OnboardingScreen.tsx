import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { BookOpen, Brain, Target, ChevronRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { useCrowth } from "../context/CrowthContext";

const slides = [
  {
    icon: BookOpen,
    title: "Learn About Investing",
    description:
      "We explain investments in simple words. Easy to understand for everyone.",
  },
  {
    icon: Brain,
    title: "AI Powered Guidance",
    description:
      "Our AI looks at companies and markets. It helps you make smart choices.",
  },
  {
    icon: Target,
    title: "Build Your Demo Portfolio",
    description:
      "Create a practice portfolio. Learn how investing works with no risk.",
  },
];

export function OnboardingScreen() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();
  const { user, authLoading } = useCrowth();

  useEffect(() => {
    if (!authLoading && user) {
      navigate("/home", { replace: true });
    }
  }, [authLoading, navigate, user]);

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
  const isLast = currentSlide === slides.length - 1;

  return (
    <div className="h-dvh min-h-dvh w-full max-w-[100vw] bg-white flex flex-col overflow-hidden safe-area-top">
      {/* Scrollable content — shrinks on short phones */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="min-h-full flex flex-col items-center justify-center px-6 sm:px-8 py-6 sm:py-10">
          <div className="w-full max-w-md flex flex-col items-center">
            <div className="w-28 h-28 sm:w-40 sm:h-40 md:w-48 md:h-48 bg-[#F5F7FA] rounded-full flex items-center justify-center mb-6 sm:mb-10">
              <Icon className="w-14 h-14 sm:w-20 sm:h-20 md:w-24 md:h-24 text-[#0A1F44]" />
            </div>

            <div className="text-center mb-6 sm:mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-[#0A1F44] mb-3 sm:mb-4 leading-snug">
                {slide.title}
              </h2>
              <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
                {slide.description}
              </p>
            </div>

            <div className="flex gap-2">
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
      </div>

      {/* Always-visible footer — Get Started never clipped */}
      <div className="shrink-0 px-5 sm:px-8 pt-3 pb-4 sm:pb-6 safe-area-bottom space-y-2.5 border-t border-gray-100 bg-white">
        {isLast && (
          <div className="p-3 sm:p-4 bg-[#F5F7FA] rounded-2xl">
            <p className="text-[11px] sm:text-xs text-[#1F2937] text-center leading-relaxed">
              Crowth is an AI investment analysis platform. This app does not
              hold funds, execute trades, or manage real investments. All
              portfolio values are simulations for educational purposes.
            </p>
          </div>
        )}
        <Button
          onClick={handleNext}
          className="w-full bg-[#0A1F44] hover:bg-[#0A1F44]/90 text-white h-12 sm:h-14 rounded-2xl text-base sm:text-lg"
        >
          {isLast ? (
            "Get Started"
          ) : (
            <>
              Next <ChevronRight className="ml-2 w-5 h-5" />
            </>
          )}
        </Button>
        {!isLast && (
          <Button
            onClick={handleSkip}
            variant="ghost"
            className="w-full text-gray-500 h-11 sm:h-14 rounded-2xl text-base sm:text-lg"
          >
            Skip
          </Button>
        )}
      </div>
    </div>
  );
}
