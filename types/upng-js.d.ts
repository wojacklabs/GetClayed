declare module 'upng-js' {
  /**
   * Encode frames into an APNG
   * @param imgs Array of frame data (Uint8Array of RGBA pixels)
   * @param w Width of the image
   * @param h Height of the image
   * @param cnum Number of colors (256 for full color)
   * @param dels Array of frame delays in milliseconds
   * @returns ArrayBuffer containing the APNG data
   */
  export function encode(
    imgs: ArrayLike<number>[] | Uint8Array[],
    w: number,
    h: number,
    cnum: number,
    dels?: number[]
  ): ArrayBuffer;

  /**
   * Decode a PNG/APNG file
   * @param buff ArrayBuffer containing the PNG data
   * @returns Decoded image data
   */
  export function decode(buff: ArrayBuffer): {
    width: number;
    height: number;
    depth: number;
    ctype: number;
    frames: Array<{
      rect: { x: number; y: number; width: number; height: number };
      delay: number;
      dispose: number;
      blend: number;
    }>;
    tabs: Record<string, any>;
    data: Uint8Array;
  };

  /**
   * Convert frames to RGBA format
   * @param out Decoded image from decode()
   * @returns Array of RGBA Uint8Arrays for each frame
   */
  export function toRGBA8(out: ReturnType<typeof decode>): Uint8Array[];
}

