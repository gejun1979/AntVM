#include <stdlib.h>
#include <stdio.h>
#include "interupt.h"
#include "i386.h"

int is_in_interupt_mode = 0;

//if interupt is triggred, then return 1, else return 0.
int check_interupt()
{
	return 0;
}

//save general registers
void enter_interupt_mode()
{
	is_in_interupt_mode = 1;
}

//restore general registers
void exit_interupt_mode()
{
	is_in_interupt_mode = 0;
}

void interupt_process()
{
	if ( check_interupt() ) {
		if ( is_in_interupt_mode == 0 ) {
			enter_interupt_mode();
		}
	} else {
		if ( is_in_interupt_mode ) {
			exit_interupt_mode();
		}
	}
}
