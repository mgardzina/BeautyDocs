import { Syringe, Zap, Sparkles, Eraser } from "lucide-react";
import { FormType } from "@/types/booking";
import { SALON_CONFIG } from "@/app/config/salon";
import Image from "next/image";

interface SelectionScreenProps {
  onSelect: (type: FormType) => void;
}

export default function SelectionScreen({ onSelect }: SelectionScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12">
      <div className="max-w-6xl w-full">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <Image
              src="/logo.png"
              alt={SALON_CONFIG.name}
              width={500}
              height={320}
              className="w-82 h-auto md:w-104 object-contain"
              priority
            />
          </div>
          <div className="w-20 h-0.5 bg-brand mx-auto mb-6" />
          <p className="text-lg text-marble-text/70 font-light tracking-wider uppercase">
            Wybierz rodzaj zabiegu
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SelectionCard
            onClick={() => onSelect("FACIAL_VOLUMETRY")}
            icon={<Syringe className="w-10 h-10" />}
            title="Wypełnianie Kwasem Hialuronowym"
            subtitle="Modelowanie twarzy"
          />

          <SelectionCard
            onClick={() => onSelect("LIP_AUGMENTATION")}
            icon={
              <svg
                viewBox="0 0 511.999 511.999"
                className="w-10 h-10"
                fill="currentColor"
              >
                <path d="M420.792,140.277c-22.891-24.035-53.77-37.81-86.947-38.787c-28.264-0.833-55.419,7.711-77.845,24.265 c-22.425-16.555-49.587-25.091-77.844-24.265c-33.177,0.977-64.056,14.752-86.947,38.787L0,236.046l14.127,27.312 c24.1,46.595,60.127,84.768,104.187,110.397c41.398,24.08,89.009,36.809,137.685,36.809c48.673,0,96.289-12.73,137.685-36.809 c44.06-25.629,80.087-63.803,104.187-110.397l14.127-27.312L420.792,140.277z M115.053,162.986 c16.868-17.712,39.622-27.863,64.072-28.583c24.462-0.717,47.761,8.075,65.641,24.764l11.234,10.484l11.234-10.484 c17.881-16.689,41.193-25.482,65.641-24.764c24.448,0.72,47.203,10.871,64.072,28.583l56.18,58.988h-65.413 c-29.757,0-43.653-5.558-59.742-11.994c-16.814-6.725-35.872-14.349-71.971-14.349c-36.099,0-55.157,7.623-71.971,14.349 c-16.09,6.435-29.984,11.994-59.742,11.994H58.873L115.053,162.986z M334.301,247.404c-17.641,13.328-40.295,27.255-78.3,27.255 c-38.005,0-60.659-13.926-78.3-27.255c6.837-2.163,12.829-4.558,18.558-6.85c16.09-6.435,29.984-11.994,59.742-11.994 c29.757,0,43.653,5.558,59.742,11.994C321.472,242.845,327.464,245.241,334.301,247.404z M377.128,345.292 c-36.377,21.16-78.263,32.343-121.129,32.343s-84.752-11.185-121.129-32.344c-36.521-21.243-66.783-52.398-87.909-90.39h82.813 c4.004,0,12.198,6.418,20.121,12.625c20.366,15.953,51.144,40.06,106.104,40.06s85.737-24.108,106.104-40.06 c7.924-6.207,16.117-12.625,20.121-12.625h82.813C443.912,292.895,413.65,324.048,377.128,345.292z" />
              </svg>
            }
            title="Modelowanie Ust"
            subtitle="Kwas hialuronowy"
          />

          <SelectionCard
            onClick={() => onSelect("INJECTION_LIPOLYSIS")}
            icon={<Syringe className="w-10 h-10" />}
            title="Lipoliza Iniekcyjna"
            subtitle="Redukcja tkanki tłuszczowej"
          />

          <SelectionCard
            onClick={() => onSelect("PERMANENT_MAKEUP")}
            icon={<Sparkles className="w-10 h-10" />}
            title="Makijaż Permanentny"
            subtitle="Zabieg makijażowy"
          />

          <SelectionCard
            onClick={() => onSelect("WRINKLE_REDUCTION")}
            icon={<Sparkles className="w-10 h-10" />}
            title="Niwelowanie Zmarszczek"
            subtitle="usuwanie zmarszczek"
          />

          <SelectionCard
            onClick={() => onSelect("LASER_HAIR_REMOVAL")}
            icon={<Zap className="w-10 h-10" />}
            title="Depilacja Laserowa"
            subtitle="Laser diodowy"
          />

          <SelectionCard
            onClick={() => onSelect("NEEDLE_MESOTHERAPY")}
            icon={<Syringe className="w-10 h-10" />}
            title="Mezoterapia igłowa"
            subtitle="Kwas polimlekowy, osocze"
          />

          <SelectionCard
            onClick={() => onSelect("LASER_TATTOO_REMOVAL")}
            icon={<Eraser className="w-10 h-10" />}
            title="Usuwanie Tatuażu"
            subtitle="Laser pikosekundowy"
          />

          <SelectionCard
            onClick={() => onSelect("EYELID_LIFT")}
            icon={<Syringe className="w-10 h-10" />}
            title="Lifting Powiek"
            subtitle="Zabieg liftingowy"
          />

          <SelectionCard
            onClick={() => onSelect("TISSUE_STIMULATION")}
            icon={<Syringe className="w-10 h-10" />}
            title="Stymulacja Tkankowa"
            subtitle="Zabieg liftingowy"
          />
          <SelectionCard
            onClick={() => onSelect("EYEBROW_TINTING")}
            icon={<Sparkles className="w-10 h-10" />}
            title="Farbowanie Rzęs i Brwi"
            subtitle="Henna / Farba"
          />
          <SelectionCard
            onClick={() => onSelect("EYEBROW_LAMINATION")}
            icon={<Sparkles className="w-10 h-10" />}
            title="Laminacja Rzęs i Brwi"
            subtitle="Laminacja / Lifting"
          />
          <SelectionCard
            onClick={() => onSelect("EYELASH_EXTENSION")}
            icon={<Sparkles className="w-10 h-10" />}
            title="Przedłużanie Rzęs"
            subtitle="1:1 / Objętościowe"
          />
        </div>

        <div className="mt-16 text-center flex gap-6 justify-center items-center">
          <a
            href="/polityka-prywatnosci"
            className="text-marble-textSecondary text-sm hover:text-brand transition-colors tracking-wider uppercase"
          >
            Polityka Prywatności
          </a>
          <span className="text-marble-border">|</span>
          <a
            href="/regulamin"
            className="text-marble-textSecondary text-sm hover:text-brand transition-colors tracking-wider uppercase"
          >
            Regulamin
          </a>
        </div>
      </div>
    </div>
  );
}

function SelectionCard({
  onClick,
  icon,
  title,
  subtitle,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      onClick={onClick}
      className="group bg-white/80 p-8 border-2 border-brand/30 hover:border-brand hover:gold-glow transition-all duration-300 rounded-3xl flex flex-col items-center gap-5 shadow-marble-lg hover:shadow-lg"
    >
      <div className="w-20 h-20 bg-brand/10 rounded-full flex items-center justify-center border-2 border-brand/30 group-hover:border-brand group-hover:bg-brand/20 transition-all duration-300 text-brand">
        {icon}
      </div>

      <div className="text-center">
        <h3 className="text-xl font-serif text-marble-text mb-1 tracking-wide">
          {title}
        </h3>
        <p className="text-sm text-marble-textSecondary tracking-wider uppercase">
          {subtitle}
        </p>
      </div>
    </button>
  );
}
