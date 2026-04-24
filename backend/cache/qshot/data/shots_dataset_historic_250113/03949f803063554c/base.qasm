OPENQASM 3.0;
include "stdgates.inc";
gate cs _gate_q_0, _gate_q_1 {
  t _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
}
gate ccz _gate_q_0, _gate_q_1, _gate_q_2 {
  h _gate_q_2;
  ccx _gate_q_0, _gate_q_1, _gate_q_2;
  h _gate_q_2;
}
gate rzz(p0) _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
}
gate rzx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  h _gate_q_1;
}
gate cu3(p0, p1, p2) _gate_q_0, _gate_q_1 {
  p(0.5*p1 + 0.5*p2) _gate_q_0;
  p((-0.5)*p1 + 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U((-0.5)*p0, 0, (-0.5)*p1 - 0.5*p2) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  U(0.5*p0, p1, 0) _gate_q_1;
}
gate sxdg _gate_q_0 {
  s _gate_q_0;
  h _gate_q_0;
  s _gate_q_0;
}
gate xx_minus_yy(p0, p1) _gate_q_0, _gate_q_1 {
  rz(-p1) _gate_q_1;
  sdg _gate_q_0;
  sx _gate_q_0;
  s _gate_q_0;
  s _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  ry(0.5*p0) _gate_q_0;
  ry((-0.5)*p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  sdg _gate_q_1;
  sdg _gate_q_0;
  sxdg _gate_q_0;
  s _gate_q_0;
  rz(p1) _gate_q_1;
}
gate dcx _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
}
gate iswap _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  s _gate_q_1;
  h _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
  h _gate_q_1;
}
gate csx _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cs _gate_q_0, _gate_q_1;
  h _gate_q_1;
}
gate r(p0, p1) _gate_q_0 {
  U(p0, -pi/2 + p1, pi/2 - p1) _gate_q_0;
}
qubit[7] q;
h q[1];
cy q[0], q[5];
cs q[4], q[3];
u3(2.8503535394095403, 3.085346268275109, 1.9250030705402101) q[6];
rx(0.2615402111330178) q[4];
sdg q[2];
sdg q[0];
ccz q[1], q[3], q[6];
u3(1.9853327830499659, 1.2090533639011698, 0.9046078317064352) q[2];
rzz(5.84830125508917) q[0], q[5];
u3(2.347875080994201, 1.1338998405706908, 3.0802957639611184) q[1];
swap q[6], q[3];
u1(0.4824502272523671) q[0];
u2(4.946761327563537, 0.2653258080355622) q[6];
U(4.6838185895933195, 0.5746144861669729, 2.0065274559645188) q[1];
rzx(3.1830100429066284) q[2], q[4];
s q[3];
sx q[5];
x q[6];
cp(5.030807165502267) q[4], q[5];
swap q[0], q[1];
cp(2.748789092644994) q[2], q[3];
rz(4.807653443262078) q[3];
cu3(0.37571825481397986, 1.7524591471837951, 6.269477701835965) q[6], q[5];
xx_minus_yy(2.882026829548923, 5.835083715636327) q[4], q[1];
dcx q[0], q[2];
crx(5.198044804717648) q[2], q[3];
sxdg q[0];
tdg q[1];
iswap q[5], q[4];
ry(2.467868571182112) q[6];
csx q[1], q[5];
rz(3.57791684133505) q[0];
u1(1.7726336570121155) q[4];
cp(5.855310965620786) q[2], q[6];
sdg q[3];
cx q[6], q[2];
xx_minus_yy(5.363930751043687, 5.147279776252317) q[4], q[0];
rx(0.40883398804823673) q[3];
rz(4.648869198857567) q[5];
u3(5.570220458522817, 5.9457618714918885, 6.2765581856704165) q[0];
r(1.3608668723460418, 2.819223694248136) q[2];
iswap q[6], q[3];
sdg q[5];
u1(1.1344851210490199) q[4];
