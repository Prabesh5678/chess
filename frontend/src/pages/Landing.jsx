import { useNavigate } from "react-router-dom";

export const  Landing=()=> {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center gap-8 px-4">
      {/* Chess icon */}
      <span className="text-7xl select-none">♟</span>

      {/* Title */}
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-2">Chess</h1>
        <p className="text-zinc-400 text-sm tracking-widest uppercase">
          Two players. One board. No luck.
        </p>
      </div>

      {/* Play button */}
      <button
        onClick={() => navigate("/game")}
        className="mt-4 px-10 py-3 bg-white text-zinc-950 text-sm font-semibold tracking-widest uppercase hover:bg-zinc-200 active:scale-95 transition-all duration-150"
      >
        Play Game
      </button>
    </div>
  );
}
