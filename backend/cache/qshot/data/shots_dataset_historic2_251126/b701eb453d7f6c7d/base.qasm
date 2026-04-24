OPENQASM 3.0;
include "stdgates.inc";
gate cs _gate_q_0, _gate_q_1 {
  t _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
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
gate sxdg _gate_q_0 {
  s _gate_q_0;
  h _gate_q_0;
  s _gate_q_0;
}
gate xx_plus_yy(p0, p1) _gate_q_0, _gate_q_1 {
  rz(p1) _gate_q_0;
  sdg _gate_q_1;
  sx _gate_q_1;
  s _gate_q_1;
  s _gate_q_0;
  cx _gate_q_1, _gate_q_0;
  ry((-0.5)*p0) _gate_q_1;
  ry((-0.5)*p0) _gate_q_0;
  cx _gate_q_1, _gate_q_0;
  sdg _gate_q_0;
  sdg _gate_q_1;
  sxdg _gate_q_1;
  s _gate_q_1;
  rz(-p1) _gate_q_0;
}
qubit[6] q;
u2(2.432779090886903, 0.8526969434557523) q[1];
U(3.6122855238948124, 3.63290204101534, 3.757045778200991) q[4];
sx q[2];
u3(1.7293538559199153, 5.415642663602099, 1.8998367205439632) q[5];
h q[0];
cs q[3], q[5];
iswap q[2], q[1];
cx q[0], q[4];
csx q[5], q[1];
cu(1.1638793150384663, 0.1806451447981392, 3.105736285370607, 6.029812786494035) q[4], q[2];
sxdg q[0];
cp(4.818286364870874) q[3], q[1];
xx_plus_yy(4.982618973328328, 2.1234440786528723) q[0], q[5];
p(4.259739159388552) q[2];
y q[4];
ry(4.980944051848245) q[0];
crz(6.104325044183122) q[1], q[5];
h q[3];
sdg q[4];
