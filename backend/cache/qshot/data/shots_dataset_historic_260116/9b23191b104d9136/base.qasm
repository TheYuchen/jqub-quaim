OPENQASM 3.0;
include "stdgates.inc";
gate rzz(p0) _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
}
gate iswap _gate_q_0, _gate_q_1 {
  s _gate_q_0;
  s _gate_q_1;
  h _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  cx _gate_q_1, _gate_q_0;
  h _gate_q_1;
}
gate cu3(p0, p1, p2) _gate_q_0, _gate_q_1 {
  p(0.5*p2 + 0.5*p1) _gate_q_0;
  p(0.5*p2 - 0.5*p1) _gate_q_1;
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
gate ryy(p0) _gate_q_0, _gate_q_1 {
  sxdg _gate_q_0;
  sxdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  sx _gate_q_0;
  sx _gate_q_1;
}
gate rccx _gate_q_0, _gate_q_1, _gate_q_2 {
  h _gate_q_2;
  t _gate_q_2;
  cx _gate_q_1, _gate_q_2;
  tdg _gate_q_2;
  cx _gate_q_0, _gate_q_2;
  t _gate_q_2;
  cx _gate_q_1, _gate_q_2;
  tdg _gate_q_2;
  h _gate_q_2;
}
gate rxx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_0;
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  h _gate_q_1;
  h _gate_q_0;
}
gate csdg _gate_q_0, _gate_q_1 {
  tdg _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
}
gate ccz _gate_q_0, _gate_q_1, _gate_q_2 {
  h _gate_q_2;
  ccx _gate_q_0, _gate_q_1, _gate_q_2;
  h _gate_q_2;
}
gate rzx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  h _gate_q_1;
}
qubit[7] q;
cy q[6], q[1];
swap q[5], q[4];
crz(0.018860922670904463) q[0], q[2];
y q[3];
ccx q[0], q[6], q[5];
crx(4.278226280706625) q[3], q[2];
ch q[1], q[4];
cz q[0], q[1];
rzz(3.154632254519874) q[6], q[4];
u1(1.4397494162390931) q[3];
iswap q[2], q[5];
cu3(1.7495909262999987, 5.061348238194573, 4.224277596030549) q[3], q[4];
cu(0.0432144025638429, 5.681675661813417, 0.5666000738005966, 4.278812679061343) q[1], q[0];
swap q[5], q[2];
y q[6];
ch q[5], q[3];
ccx q[1], q[6], q[2];
id q[0];
u2(6.23284304426665, 2.1699795118114813) q[4];
t q[1];
ryy(1.6075433122120124) q[4], q[5];
rz(1.611179567159901) q[0];
cu(3.935683427222347, 4.261368262071684, 3.6109893749701722, 1.1169707966224052) q[2], q[3];
rccx q[0], q[4], q[6];
rxx(0.5181894088929307) q[2], q[1];
swap q[3], q[5];
crx(1.843763289546724) q[6], q[0];
rccx q[2], q[4], q[1];
csdg q[5], q[3];
rccx q[1], q[0], q[3];
ccx q[4], q[5], q[2];
sdg q[6];
rccx q[1], q[4], q[0];
swap q[5], q[3];
cx q[2], q[6];
ch q[6], q[3];
ccx q[2], q[5], q[0];
crz(0.8623725455993924) q[1], q[4];
ccx q[5], q[4], q[1];
ccz q[0], q[3], q[2];
u2(4.433433642675641, 1.4031982128942313) q[6];
rx(2.763598280571488) q[6];
cu3(1.0222749811260763, 0.8018677627700265, 4.3321399802240075) q[0], q[4];
ccz q[2], q[5], q[3];
u3(3.6301704066945932, 3.987583440351089, 4.929420893589574) q[1];
cp(5.691174904527863) q[0], q[2];
cswap q[3], q[1], q[6];
sx q[4];
rzx(1.4517068960022932) q[5], q[0];
cswap q[4], q[3], q[1];
