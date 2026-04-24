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
gate rzx(p0) _gate_q_0, _gate_q_1 {
  h _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  h _gate_q_1;
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
qubit[7] q;
csx q[4], q[0];
u3(2.6640168373893744, 4.542456485544549, 0.7756421028199585) q[6];
cry(4.270915522560637) q[5], q[2];
t q[1];
cy q[4], q[2];
cs q[0], q[5];
ch q[6], q[3];
ryy(3.299305357900546) q[3], q[0];
ry(4.13372922590669) q[5];
cu(5.36558250188485, 2.5585010299288204, 0.30399872299039343, 1.0127649884861407) q[1], q[6];
cz q[2], q[4];
cu(4.333091702512775, 3.7643283387561013, 4.9919433561672495, 1.523049639266912) q[0], q[2];
crx(1.6416142869068466) q[6], q[1];
U(5.724029264198361, 5.623510313603768, 0.09343226112898682) q[3];
rzx(4.936366996954363) q[4], q[5];
cz q[6], q[1];
csx q[5], q[2];
z q[0];
rxx(0.20978826964716327) q[4], q[3];
