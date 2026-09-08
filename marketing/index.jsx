import React from "react";
import {
  AbsoluteFill,
  Audio,
  Composition,
  Freeze,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  registerRoot,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import marks from "./public/capture.json";

const ink = "#f3f4f5",
  muted = "#a4abb7",
  blue = "#92b6ff";
const ease = (f, a = 0, b = 25) =>
  interpolate(f, [a, b], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
const Label = ({ children }) => (
  <div
    style={{
      fontSize: 19,
      letterSpacing: 4,
      textTransform: "uppercase",
      color: blue,
      fontWeight: 600,
    }}
  >
    {children}
  </div>
);
function Scene({ children }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        opacity: Math.min(
          ease(f),
          interpolate(f, [1850, 1860], [1, 0], { extrapolateLeft: "clamp" }),
        ),
      }}
    >
      {children}
    </AbsoluteFill>
  );
}
function Heading({ kicker, title, sub }) {
  const f = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: 110,
        top: 78,
        transform: `translateY(${(1 - ease(f)) * 20}px)`,
      }}
    >
      <Label>{kicker}</Label>
      <h1
        style={{
          fontSize: 64,
          letterSpacing: -2.7,
          margin: "16px 0 12px",
          fontWeight: 600,
        }}
      >
        {title}
      </h1>
      <div style={{ fontSize: 25, color: muted }}>{sub}</div>
    </div>
  );
}
function Foot({
  text = "NIGHTCODE / 0.2.0",
  right = "Windows · Bring your own provider",
}) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 34,
        left: 110,
        right: 110,
        display: "flex",
        justifyContent: "space-between",
        fontSize: 16,
        color: muted,
        letterSpacing: 1,
      }}
    >
      <span>{text}</span>
      <span>{right}</span>
    </div>
  );
}
function Screen({ start, still, zoom = 1, origin = "center" }) {
  const f = useCurrentFrame();
  const enter = spring({
    frame: f,
    fps: 30,
    config: { damping: 24, stiffness: 100 },
  });
  return (
    <div
      style={{
        position: "absolute",
        left: 190,
        top: 280,
        width: 1540,
        height: 710,
        border: "1px solid #43464d",
        borderRadius: 22,
        overflow: "hidden",
        boxShadow: "0 40px 90px #0009",
        transform: `translateY(${(1 - enter) * 36}px)`,
      }}
    >
      <div
        style={{
          height: "100%",
          width: "100%",
          transform: `scale(${zoom + ease(f, 0, 230) * 0.025})`,
          transformOrigin: origin,
        }}
      >
        {still ? (
          <Img
            src={staticFile(still)}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        ) : (
          <OffthreadVideo
            src={staticFile("workspace.webm")}
            startFrom={Math.max(0, Math.round(start * 30))}
            muted
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        )}
      </div>
    </div>
  );
}
function Clip({ start, hold, zoom = 1 }) {
  const f = useCurrentFrame();
  return (
    <Freeze frame={Math.min(f, hold)}>
      <Screen start={start} zoom={zoom} />
    </Freeze>
  );
}
function Intro() {
  const f = useCurrentFrame();
  return (
    <Scene>
      <div style={{ position: "absolute", left: 150, top: 190 }}>
        <Img
          src={staticFile("logo.png")}
          style={{
            width: 100,
            height: 100,
            borderRadius: 24,
            marginBottom: 45,
          }}
        />
        <Label>Meet NightCode</Label>
        <div
          style={{
            fontSize: 104,
            lineHeight: 1.09,
            letterSpacing: -5,
            fontWeight: 600,
            marginTop: 24,
          }}
        >
          Your next idea.
          <br />
          <span style={{ color: blue }}>Within reach.</span>
        </div>
        <div
          style={{
            fontSize: 30,
            color: muted,
            marginTop: 34,
            opacity: ease(f, 30, 55),
          }}
        >
          A coding-agent workspace you can inspect.
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          width: 490,
          height: 490,
          right: 160,
          top: 265,
          border: "1px solid #586b8738",
          borderRadius: 110,
          transform: `rotate(${12 - ease(f) * 6}deg)`,
          background: "linear-gradient(135deg,#9db9f91a,#15181e)",
        }}
      >
        <Img
          src={staticFile("logo.png")}
          style={{
            width: 300,
            height: 300,
            margin: 95,
            borderRadius: 65,
            transform: `scale(${0.9 + ease(f) * 0.1})`,
          }}
        />
      </div>
      <Foot />
    </Scene>
  );
}
function Workspace() {
  return (
    <Scene>
      <Heading
        kicker="01 / Start with intent"
        title="One place to move the work forward."
        sub="Projects, conversations, and a clear place to begin."
      />
      <Clip start={marks.welcome} hold={78} />
      <Foot />
    </Scene>
  );
}
function Skills() {
  return (
    <Scene>
      <Heading
        kicker="02 / Focus the agent"
        title="The right guidance, on demand."
        sub="Call focused workflows with @skillname. Add your own."
      />
      <Clip start={marks.skills} hold={115} zoom={1.04} />
      <Foot right="Gameplay · Graphics · UI · Performance · QA" />
    </Scene>
  );
}
function Models() {
  return (
    <Scene>
      <Heading
        kicker="03 / Stay in control"
        title="Your provider. Your model."
        sub="Choose your setup and adjust reasoning where supported."
      />
      <Sequence durationInFrames={75}>
        <Screen start={marks.models} zoom={1.08} origin="right bottom" />
      </Sequence>
      <Sequence from={75}>
        <Screen still="models.png" zoom={1.08} origin="right bottom" />
      </Sequence>
      <Foot right="Recorded interface · Local demo provider" />
    </Scene>
  );
}
function Review() {
  return (
    <Scene>
      <Heading
        kicker="04 / Inspect the work"
        title="Changes you can review."
        sub="Follow tool activity. Approve edits. Inspect command checks."
      />
      <Sequence durationInFrames={45}>
        <Screen still="review.png" />
      </Sequence>
      <Sequence from={45} durationInFrames={135}>
        <Screen start={marks.review} />
      </Sequence>
      <Sequence from={180}>
        <Screen still="work.png" />
      </Sequence>
      <Foot right="Scripted local demo · Real file edit and command execution" />
    </Scene>
  );
}
function Results() {
  const f = useCurrentFrame();
  const widths = [297.725, 242.765];
  return (
    <Scene>
      <Heading
        kicker="05 / Measured iteration"
        title="Better results start with real checks."
        sub="Three paired repair tasks. All passed before and after."
      />
      <div style={{ position: "absolute", left: 112, top: 340, width: 960 }}>
        <Label>Three repair tasks · combined seconds</Label>
        {widths.map((v, i) => (
          <div key={i} style={{ marginTop: 40 }}>
            <div
              style={{ fontSize: 24, marginBottom: 15, color: i ? ink : muted }}
            >
              {i ? "Updated candidate" : "Baseline"}{" "}
              <span style={{ float: "right" }}>{v.toFixed(1)} s</span>
            </div>
            <div
              style={{
                height: 58,
                width: `${(v / 300) * 100 * ease(f, 15 + i * 8, 65 + i * 8)}%`,
                borderRadius: 8,
                background: i ? blue : "#4d5563",
              }}
            />
          </div>
        ))}
        <div
          style={{ fontSize: 21, color: muted, marginTop: 45, lineHeight: 1.6 }}
        >
          Same Muse Spark 1.3 Contributor model.
          <br />
          Two tasks faster; one slower. Single paired attempts.
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          right: 110,
          top: 365,
          width: 540,
          borderLeft: "1px solid #414650",
          paddingLeft: 64,
        }}
      >
        <div
          style={{
            fontSize: 115,
            letterSpacing: -7,
            color: blue,
            fontWeight: 600,
          }}
        >
          18.5<span style={{ fontSize: 58 }}>%</span>
        </div>
        <div style={{ fontSize: 33, lineHeight: 1.4 }}>
          less combined time
          <br />
          across three retests
        </div>
        <div
          style={{ fontSize: 21, color: muted, marginTop: 38, lineHeight: 1.6 }}
        >
          A small benchmark,
          <br />
          not a universal speed claim.
        </div>
      </div>
      <Foot right="Methodology and data: docs/benchmarks" />
    </Scene>
  );
}
function End() {
  return (
    <Scene>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
        }}
      >
        <Img
          src={staticFile("logo.png")}
          style={{
            width: 110,
            height: 110,
            borderRadius: 25,
            marginBottom: 34,
          }}
        />
        <Label>NightCode</Label>
        <div
          style={{
            fontSize: 88,
            letterSpacing: -4,
            marginTop: 24,
            fontWeight: 600,
          }}
        >
          Build. Inspect. Ship.
        </div>
        <div style={{ fontSize: 28, color: muted, marginTop: 26 }}>
          Open source. Windows desktop. Your choice of model.
        </div>
        <div
          style={{
            marginTop: 58,
            background: ink,
            color: "#15171b",
            padding: "23px 38px",
            borderRadius: 12,
            fontSize: 25,
            fontWeight: 600,
          }}
        >
          github.com/NightBeamStudioDEV/NightCode
        </div>
      </div>
      <Foot right="Download the installer or portable build" />
    </Scene>
  );
}
function Film() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background: "#101216",
        color: ink,
        fontFamily: "Inter, sans-serif",
      }}
    >
      <style>{`@font-face{font-family:Inter;src:url('${staticFile("inter.woff2")}') format('woff2');font-weight:100 900}*{box-sizing:border-box}`}</style>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 70% 15%,#30466435,transparent 62%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: 3,
          width: `${(f / 1410) * 100}%`,
          background: blue,
        }}
      />
      <Audio src={staticFile("soundtrack.wav")} volume={0.5} />
      <Sequence durationInFrames={165}>
        <Intro />
      </Sequence>
      <Sequence from={165} durationInFrames={225}>
        <Workspace />
      </Sequence>
      <Sequence from={390} durationInFrames={210}>
        <Skills />
      </Sequence>
      <Sequence from={600} durationInFrames={150}>
        <Models />
      </Sequence>
      <Sequence from={750} durationInFrames={240}>
        <Review />
      </Sequence>
      <Sequence from={990} durationInFrames={240}>
        <Results />
      </Sequence>
      <Sequence from={1230} durationInFrames={180}>
        <End />
      </Sequence>
    </AbsoluteFill>
  );
}
registerRoot(() => (
  <Composition
    id="NightCodeLaunch"
    component={Film}
    durationInFrames={1410}
    fps={30}
    width={1920}
    height={1080}
  />
));
