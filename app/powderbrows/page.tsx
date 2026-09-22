"use client";

import { useState } from "react";
import SelectionScreen from "../components/SelectionScreen";
import FacialVolumetryForm from "../components/forms/FacialVolumetryForm";
import LaserRemovalForm from "../components/forms/LaserRemovalForm";
import LaserTattoRemovalForm from "../components/forms/LaserTattoRemovalForm";
import NeedleMesotherapyForm from "../components/forms/NeedleMesotherapyForm";
import LipModelingForm from "../components/forms/LipModelingForm";
import WrinkleLevelingForm from "../components/forms/WrinkleLevelingForm";
import { FormType } from "../../types/booking";
import PermamentMakeupForm from "../components/forms/PermamentMakeupForm";
import InjectionLipolysisForm from "../components/forms/InjectionLipolysisForm";
import EyelidLiftForm from "../components/forms/EyelidLiftForm";
import TissueStimulationForm from "../components/forms/TissueStimulationForm";
import EyebrowTintingForm from "../components/forms/EyebrowTintingForm";
import EyebrowLaminationForm from "../components/forms/EyebrowLaminationForm";
import EyelashExtensionForm from "../components/forms/EyelashExtensionForm";
import FacialCleansingForm from "../components/forms/FacialCleansingForm";

export default function HomePage() {
  const [selectedForm, setSelectedForm] = useState<FormType | null>(null);

  if (!selectedForm) {
    return (
      <SelectionScreen
        onSelect={(type) => {
          setSelectedForm(type);
          window.scrollTo(0, 0);
        }}
      />
    );
  }

  // Renderowanie odpowiedniego formularza
  switch (selectedForm) {
    case "LIP_AUGMENTATION":
      return <LipModelingForm onBack={() => setSelectedForm(null)} />;
    case "FACIAL_VOLUMETRY":
      return <FacialVolumetryForm onBack={() => setSelectedForm(null)} />;
    case "WRINKLE_REDUCTION":
      return <WrinkleLevelingForm onBack={() => setSelectedForm(null)} />;
    case "LASER_HAIR_REMOVAL":
      return <LaserRemovalForm onBack={() => setSelectedForm(null)} />;
    case "LASER_TATTOO_REMOVAL":
      return <LaserTattoRemovalForm onBack={() => setSelectedForm(null)} />;
    case "PERMANENT_MAKEUP":
      return <PermamentMakeupForm onBack={() => setSelectedForm(null)} />;
    case "INJECTION_LIPOLYSIS":
      return <InjectionLipolysisForm onBack={() => setSelectedForm(null)} />;
    case "NEEDLE_MESOTHERAPY":
      return <NeedleMesotherapyForm onBack={() => setSelectedForm(null)} />;
    case "EYELID_LIFT":
      return <EyelidLiftForm onBack={() => setSelectedForm(null)} />;
    case "TISSUE_STIMULATION":
      return <TissueStimulationForm onBack={() => setSelectedForm(null)} />;
    case "EYEBROW_TINTING":
      return <EyebrowTintingForm onBack={() => setSelectedForm(null)} />;
    case "EYEBROW_LAMINATION":
      return <EyebrowLaminationForm onBack={() => setSelectedForm(null)} />;
    case "EYELASH_EXTENSION":
      return <EyelashExtensionForm onBack={() => setSelectedForm(null)} />;
    case "FACIAL_CLEANSING":
      return <FacialCleansingForm onBack={() => setSelectedForm(null)} />;
    default:
      return <div>Formularz nieznany</div>;
  }
}
