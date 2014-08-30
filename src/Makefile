CC=		gcc
STD=	_GNU_SOURCE
OBJS=	main.o

.c.o:
	$(CC) -c -Wall $(CFLAGS) -D$(STD) $<

all: antvm

antvm: $(OBJS)
	$(CC) $(OBJS) -o antvm

clean:
	rm -f *.o

clobber: clean
	rm -f antvm
