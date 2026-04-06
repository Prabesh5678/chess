import './App.css'
import { Routes, Route } from "react-router-dom";
import { Landing } from './pages/Landing';
import Game  from './pages/Game';

function App() {
  return (
    <div>
      <Routes>
        <Route path="/" element={<Landing/>} />
        <Route path="/game" element={<Game/>} />
      </Routes>
    </div>
  );
}
export default App;
