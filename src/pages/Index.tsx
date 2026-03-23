import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import ProofStrip from "@/components/landing/ProofStrip";
import ProductMock from "@/components/landing/ProductMock";
import BentoGrid from "@/components/landing/BentoGrid";
import ProblemSolution from "@/components/landing/ProblemSolution";
import HowItWorks from "@/components/landing/HowItWorks";
import Features from "@/components/landing/Features";
import CitationControl from "@/components/landing/CitationControl";
import FrameworkLibrary from "@/components/landing/FrameworkLibrary";
import Pricing from "@/components/landing/Pricing";
import CTABanner from "@/components/landing/CTABanner";
import Footer from "@/components/landing/Footer";
import ZoeHomeChat from "@/components/chat/ZoeHomeChat";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <ProofStrip />
      <ProductMock />
      <BentoGrid />
      <ProblemSolution />
      <HowItWorks />
      <Features />
      <CitationControl />
      <FrameworkLibrary />
      <Pricing />
      <CTABanner />
      <Footer />
      <ZoeHomeChat />
    </div>
  );
};

export default Index;
