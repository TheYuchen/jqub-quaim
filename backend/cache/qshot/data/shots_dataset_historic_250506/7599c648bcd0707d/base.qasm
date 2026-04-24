OPENQASM 3.0;
include "stdgates.inc";
gate cs _gate_q_0, _gate_q_1 {
  t _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
}
gate csx _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cs _gate_q_0, _gate_q_1;
  h _gate_q_1;
}
gate sxdg _gate_q_0 {
  s _gate_q_0;
  h _gate_q_0;
  s _gate_q_0;
}
gate ryy(p0) _gate_q_0, _gate_q_1 {
  sxdg _gate_q_0;
  sxdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  sx _gate_q_0;
  sx _gate_q_1;
}
gate cu1(p0) _gate_q_0, _gate_q_1 {
  p(0.5*p0) _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  p((-0.5)*p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  p(0.5*p0) _gate_q_1;
}
gate ecr _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  sx _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  x _gate_q_0;
}
gate iswap _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  s _gate_q_1;
  h _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
  h _gate_q_1;
}
gate csdg _gate_q_0, _gate_q_1 {
  tdg _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
}
gate cu3(p0, p1, p2) _gate_q_0, _gate_q_1 {
  p(0.5*p1 + 0.5*p2) _gate_q_0;
  p((-0.5)*p1 + 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U((-0.5)*p0, 0, (-0.5)*p1 - 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U(0.5*p0, p1, 0) _gate_q_1;
}
gate rzz(p0) _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
}
qubit[7] q;
ch q[2], q[0];
crx(3.8898880341718667) q[4], q[5];
cu(1.2639391290917374, 0.7594685279402619, 3.424537117304534, 5.0933651973444976) q[3], q[1];
sx q[6];
cp(4.365435860268318) q[0], q[4];
csx q[6], q[2];
ryy(0.5456955161543757) q[3], q[5];
cu1(0.44420818929557904) q[1], q[4];
ecr q[2], q[5];
cswap q[0], q[6], q[3];
iswap q[6], q[2];
csdg q[4], q[0];
cswap q[5], q[3], q[1];
cu3(1.8404882598162748, 5.858415791456055, 3.6238273800073135) q[3], q[6];
cu1(0.42369889061294197) q[0], q[5];
cx q[2], q[4];
rx(5.7447251731923314) q[1];
ccx q[3], q[6], q[4];
ccx q[1], q[5], q[2];
cswap q[2], q[5], q[3];
cry(0.010689672492907571) q[4], q[6];
cz q[0], q[1];
y q[1];
rzz(0.4879603182541228) q[3], q[5];
cs q[2], q[0];
u3(2.209565315490651, 0.6188937768130345, 2.63856708146825) q[6];
