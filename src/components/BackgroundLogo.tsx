import Image from "next/image"

/**
 * Faded large logo behind hero text. Position the parent `relative`.
 * Pointer-events disabled so it doesn't intercept clicks.
 */
export function BackgroundLogo() {
  return (
    <div className="bg-logo" aria-hidden="true">
      <Image
        src="/logo.jpeg"
        alt=""
        width={1200}
        height={1200}
        priority
        className="select-none"
      />
    </div>
  )
}
