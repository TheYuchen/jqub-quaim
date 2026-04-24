OPENQASM 3.0;
include "stdgates.inc";
gate csdg _gate_q_0, _gate_q_1 {
  tdg _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  t _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  tdg _gate_q_1;
}
gate cu1(p0) _gate_q_0, _gate_q_1 {
  p(0.5*p0) _gate_q_0;
  cx _gate_q_0, _gate_q_1;
  p((-0.5)*p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
  p(0.5*p0) _gate_q_1;
}
gate rzz(p0) _gate_q_0, _gate_q_1 {
  cx _gate_q_0, _gate_q_1;
  rz(p0) _gate_q_1;
  cx _gate_q_0, _gate_q_1;
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
gate sxdg _gate_q_0 {
  s _gate_q_0;
  h _gate_q_0;
  s _gate_q_0;
}
qubit[5] q;
p(3.7648685831901543) q[1];
crz(2.7807597904116235) q[0], q[4];
u1(2.498005889509499) q[2];
ry(6.047789856793192) q[3];
u1(2.3501109912669405) q[3];
csdg q[2], q[4];
crz(1.2137008304739862) q[0], q[1];
cu1(1.985444927968373) q[4], q[1];
s q[2];
rzz(2.7952456227348708) q[3], q[0];
rxx(5.774903409636629) q[3], q[1];
rxx(2.0283528657778165) q[4], q[2];
cy q[3], q[4];
sxdg q[2];
rxx(3.8279662217553825) q[1], q[0];
