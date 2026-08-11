import Image from "next/image";
import { PRODUCT_LOGO_PATH } from "@/lib/config";
import { cn } from "@/lib/utils";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <Image
      src={PRODUCT_LOGO_PATH}
      alt=""
      width={404}
      height={222}
      sizes="80px"
      unoptimized
      className={cn("h-auto shrink-0 object-contain", className)}
    />
  );
}
