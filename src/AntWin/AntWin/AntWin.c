#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include "getopt.h"
#include "i386/i386_arch.h"
#include "i386/i386_emu.h"
#include "i386/i386_utility.h"

#define VERSION "0.0.2"
#define PATH_MAX 512

void usage(const char * name)
{
	fprintf(stdout, "Usage: %s <-b bios> <-f rootfs> <-k linuxkernel> [-l fileloglevel] [-s screenloglevel]\n", name);
	fprintf(stdout, "-b		bios image path\n");
	fprintf(stdout, "-f		rootfs image path\n");
	fprintf(stdout, "-k		linux kernel image path\n");
	fprintf(stdout, "-l		set an int value which is log level of log file\n");
	fprintf(stdout, "    1 - debug\n");
	fprintf(stdout, "    2 - log\n");
	fprintf(stdout, "    3 - warning\n");
	fprintf(stdout, "    4 - error\n");
	fprintf(stdout, "-s  set an int value which is log level of screen log\n");
	fprintf(stdout, "    1 - debug\n");
	fprintf(stdout, "    2 - log\n");
	fprintf(stdout, "    3 - warning\n");
	fprintf(stdout, "    4 - error\n");
	fprintf(stdout, "-v		show version\n");
	fprintf(stdout, "-h		this help page\n");
}

void show_version()
{
	fprintf(stdout, "version:%s\n", VERSION);
}

int main(int argc, char * argv[])
{
	int c;
	int result = EXIT_SUCCESS;
	char bios_path[PATH_MAX] = { 0 };
	char rootfs_path[PATH_MAX] = { 0 };
	char kernel_path[PATH_MAX] = { 0 };

	while ((c = getopt_a(argc, argv, "b:f:k:l:s:vdh")) != -1) {
		switch (c) {
		case 'b':
			strcpy(bios_path, optarg_a);
			break;
		case 'f':
			strcpy(rootfs_path, optarg_a);
			break;
		case 'k':
			strcpy(kernel_path, optarg_a);
			break;
		case 'v':
			show_version();
			goto end;
		case 'h':
			usage(argv[0]);
			goto end;
		case 'l':
			file_log_level = (log_level)atoi(optarg_a);
			break;
		case 's':
			screen_log_level = (log_level)atoi(optarg_a);
			break;
		default:
			usage(argv[0]);

			result = EXIT_FAILURE;
			goto end;
		}
	}

	if (optind < argc) {
		fprintf(stderr, "Error: unknown argument");
		for (; optind < argc; ++optind) {
			fprintf(stderr, ", %s", argv[optind]);
		}
		fprintf(stderr, "\n");
		usage(argv[0]);

		result = EXIT_FAILURE;
		goto end;
	}

	if (strlen(bios_path) == 0) {
		fprintf(stderr, "Error: bios image path can't be empty.\n");
		usage(argv[0]);

		result = EXIT_FAILURE;
		goto end;
	}

	if (strlen(rootfs_path) == 0) {
		fprintf(stderr, "Error: rootfs image path can't be empty.\n");
		usage(argv[0]);

		result = EXIT_FAILURE;
		goto end;
	}

	if (strlen(kernel_path) == 0) {
		fprintf(stderr, "Error: linux kernel image path can't be empty.\n");
		usage(argv[0]);

		result = EXIT_FAILURE;
		goto end;
	}

	ant_log_init();

	int emu_res = emulator_i386(bios_path, kernel_path, rootfs_path);
	if (emu_res) {
		fprintf(stderr, "i386 emulater failed with %d\n", emu_res);

		result = EXIT_FAILURE;
		goto end;
	}

end:
	return result;
}
