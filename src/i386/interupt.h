#ifndef _EMULATOR_INTERUPT_H_
#define _EMULATOR_INTERUPT_H_

//if interupt is triggred, then return 1, else return 0.
int check_interupt();

//save general registers
void enter_interupt_mode();

//restore general registers
void exit_interupt_mode();

void interupt_process();

#endif
