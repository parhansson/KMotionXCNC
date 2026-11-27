#include "KMotionDef.h"
 /*

    This test shows how a function parameter is loaded with wrong
    opcode in some cases

    Fix by replacing this statement
    sym_push(sym->v & ~SYM_FIELD, type, VT_LOCAL | VT_LVAL, addr);
    with this
    sym_push(sym->v & ~SYM_FIELD, type, VT_LOCAL | lvalue_type(type->t), addr);

    new version(0.9.26) c67-gen.c gfunc_prolog() around line 2285
    old version(0.9.16) i386-gen-c gfunc_prolog() around line 2890
  */
 void test(unsigned char p1, unsigned char uch_param,unsigned char p3)
 {
  char ch;
  unsigned char uch;
  //uch_param is loaded from memory with LDBU.D
  uch = uch_param;
  unsigned int r = 0;
  r = 0x33;
  //uch_param is loaded from memory with LDW.D
  //type is lost in cast and should be recovered by the symbols associated register
  //however that information is not stored in the old code
  ch = uch_param;
  printf("sizeof(int) %d\n",sizeof(int)); //prints 00f3
  //r = uch_param;
  r = uch = uch_param;
  printf("%08x\n",r); //prints 00f3

  //r = ch;
  printf("%08X %c\n",r, uch_param);
}

main()
{
  printf("main\n");
  test(0x22,0xA0,0xf3);
  return;
}
