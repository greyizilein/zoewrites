const universities = [
  "UCL", "King's College London", "Manchester", "Leeds", "Birmingham",
  "Edinburgh", "Lagos", "Covenant", "Bristol", "Warwick",
  "Sheffield", "Nottingham", "Glasgow", "Liverpool", "Southampton",
  "Durham", "Exeter", "Sussex", "Cardiff", "Queen Mary",
];

const ProofStrip = () => {
  return (
    <div className="py-6 overflow-hidden" style={{ background: "#1a1714" }}>
      <p className="text-center text-[10px] text-white/15 uppercase tracking-widest font-semibold mb-4">
        Trusted by students at
      </p>
      <div className="relative">
        <div className="flex animate-slide-left">
          {[...universities, ...universities].map((uni, i) => (
            <span
              key={i}
              className="text-xs text-white/15 font-medium whitespace-nowrap px-6"
            >
              {uni}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProofStrip;
