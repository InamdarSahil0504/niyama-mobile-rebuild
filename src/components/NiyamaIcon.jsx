import Svg, { Circle, Ellipse, Line } from 'react-native-svg';

/**
 * Niyama Life icon — transparent background version (niyama-icon-nobg).
 * Used in-app throughout. For the home screen icon (sage green bg) pass
 * showBackground={true}.
 *
 * Props:
 *   size          — number, controls width and height (default 40)
 *   showBackground — bool, renders sage green circular background (default false)
 */
export default function NiyamaIcon({ size = 40, showBackground = false }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
    >
      {showBackground && (
        <Circle cx={256} cy={256} r={256} fill="#4A7A68" />
      )}

      {/* Stem */}
      <Line
        x1={256}
        y1={420}
        x2={256}
        y2={174}
        stroke="#4A7A68"
        strokeWidth={24}
        strokeLinecap="round"
      />

      {/* Left leaf */}
      <Ellipse
        cx={163}
        cy={308}
        rx={108}
        ry={70}
        fill="#4A7A68"
        transform="rotate(-30, 163, 308)"
      />

      {/* Right leaf — slightly transparent */}
      <Ellipse
        cx={349}
        cy={236}
        rx={108}
        ry={70}
        fill="#4A7A68"
        fillOpacity={0.75}
        transform="rotate(30, 349, 236)"
      />

      {/* Gold dot */}
      <Circle cx={256} cy={154} r={48} fill="#C9973A" />
    </Svg>
  );
}
