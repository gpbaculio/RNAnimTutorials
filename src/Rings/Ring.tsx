import {
  Circle,
  Group,
  Path,
  Skia,
  SweepGradient,
  type Vector,
  Shadow,
  PathOp,
  Shader,
  Fill,
  mixColors,
} from "@shopify/react-native-skia";
import React, { useEffect, useMemo } from "react";
import {
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { frag } from "../components";

const source = frag`
uniform shader image;
uniform vec2 head;
uniform float progress;
uniform vec4 color;

vec2 rotate(in vec2 coord, in float angle, vec2 origin) {
  vec2 coord1 = coord - origin;
  vec2 rotated = coord1 * mat2( cos(angle), -sin(angle),
                       sin(angle),  cos(angle));
  return rotated + origin;
 }

vec4 main(vec2 xy) {
  if (progress > 1) {
    return color;
  }
  return image.eval(head);
}
`;

const fromCircle = (center: Vector, r: number) => {
  "worklet";
  return Skia.XYWHRect(center.x - r, center.y - r, r * 2, r * 2);
};

interface Ring {
  colors: string[];
  background: string;
  size: number;
  totalProgress: number;
}

interface RingProps {
  ring: Ring;
  center: Vector;
  strokeWidth: number;
}

export const Ring = ({
  center,
  strokeWidth,
  ring: { size, background, totalProgress, colors },
}: RingProps) => {
  const trim = useSharedValue(0);
  const r = size / 2 - strokeWidth / 2;

  const clip = useMemo(() => {
    const outerCircle = Skia.Path.Make();
    outerCircle.addCircle(center.x, center.y, size / 2);
    const innerCircle = Skia.Path.Make();
    innerCircle.addCircle(center.x, center.y, size / 2 - strokeWidth);
    return Skia.Path.MakeFromOp(outerCircle, innerCircle, PathOp.Difference)!;
  }, [center.x, center.y, size, strokeWidth]);

  const fullPath = useMemo(() => {
    const path = Skia.Path.Make();
    const fullRevolutions = Math.floor(totalProgress);
    for (let i = 0; i < fullRevolutions; i++) {
      path.addCircle(center.x, center.y, r);
    }
    path.addArc(fromCircle(center, r), 0, 360 * (totalProgress % 1));
    return path;
  }, [center, r, totalProgress]);

  const path = useDerivedValue(() => {
    if (trim.value < 1) {
      return fullPath.copy().trim(0, trim.value, false)!;
    }
    return fullPath;
  });

  const head = useDerivedValue(() => {
    const point = path.value.getLastPt()!;
    return point;
  });
  const headClip = useDerivedValue(() => {
    const c = path.value.getLastPt()!;
    const progress = trim.value * totalProgress;
    const p = Skia.Path.Make();
    p.addRect(
      Skia.XYWHRect(c.x - strokeWidth, c.y, strokeWidth * 2, strokeWidth * 2)
    );
    const angle = (progress % 1) * 2 * Math.PI;
    const m = Skia.Matrix();
    m.translate(c.x, c.y);
    m.rotate(angle);
    m.translate(-c.x, -c.y);
    p.transform(m);
    return p;
  });

  const matrix = useDerivedValue(() => {
    const m = Skia.Matrix();
    const progress = trim.value * totalProgress;
    const angle = progress < 1 ? 0 : (progress % 1) * 2 * Math.PI;
    if (angle > 0) {
      m.translate(center.x, center.y);
      m.rotate(angle);
      m.translate(-center.x, -center.y);
    }
    return m;
  });

  const uniforms = useDerivedValue(() => {
    return {
      head: head.value,
      progress: trim.value * totalProgress,
      color: [...Skia.Color(colors[1])],
    };
  }, []);

  useEffect(() => {
    trim.value = withTiming(1, { duration: 3000 });
  }, [trim]);

  return (
    <Group transform={[{ rotate: -Math.PI / 2 }]} origin={center}>
      <Group clip={clip}>
        <Fill color={background} />
        <Circle
          c={fullPath.getPoint(0)}
          r={strokeWidth / 2}
          color={colors[0]}
        />
        <Path
          path={path}
          strokeWidth={strokeWidth}
          style="stroke"
          color={colors[0]}
        >
          <SweepGradient colors={colors} c={center} matrix={matrix} />
        </Path>
        <Circle clip={headClip} c={head} r={strokeWidth / 2} color={colors[1]}>
          <Shader source={source} uniforms={uniforms}>
            <SweepGradient colors={colors} c={center} matrix={matrix} />
            <Shadow dx={0} dy={0} color="black" blur={15} />
          </Shader>
        </Circle>
      </Group>
    </Group>
  );
};
