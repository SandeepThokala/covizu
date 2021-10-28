#import python libraries
import json
import re

#define path to working directory
path = "./" # path to cloned pokay directory
mut_dict = {}

# create function to reformat charaterized mutations
# new format => aa, gene, refAA, codon, queryAA
def reformatMutations(subt, dels, func):

	# define list & dictionary object
	# to store data
	mut_list = []

	# iterate through mutations
	for c, i in enumerate(subt):
		subs = i.values()
		muts = "{}:{}:{}{}{}".format("aa",subs[2], subs[0], subs[3], subs[1])
		mut_list.append(muts)

	# iterate through deletions if any
	for n, j in enumerate(dels):
		if dels == "None":
			dells = []
		else:
			dell = j.values()
			dells = "{}:{}:{}{}{}".format("aa", dell[1], dell[0], dell[2], "-")
			mut_list.append(dells)

	for mut in mut_list:
		if mut not in mut_dict:
			mut_dict[mut] = [func]
		elif func not in mut_dict[mut]:
			mut_dict[mut].append(func)

# open JSON file
# return JSON object as a dictionary
jfile = open(path + 'mutation_annotations.json',)
data = json.load(jfile)

# output JSON
outfile = open(path + 'mut_annotations.json', 'w')

# iterating through pokay generated mutation annotations
for i in range(0, len(data)):
	subs = data[i]["substitutions"]
	dels = data[i]["deletions"]
	func = data[i]["description"]

	#run function
	reformatMutations(subs, dels, func)
	
	# write result to JSON file
	# json.dump(result, outfile, indent=4, ensure_ascii=False, separators=(',', ':'))
json.dump(mut_dict, outfile, indent=4, ensure_ascii=False, separators=(',', ':'))

# closing files
jfile.close()
outfile.close()


# fix JSON file issues, add commas
# and a square brackets at the begin and end of file
# with open(path + "mut_annotations.json", "r+") as fyl:
# 	edit_f = fyl.read()
# 	fyl.seek(0)
# 	j_son = '[' + edit_f  + ']'
# 	j_son = j_son.replace('}{', '},{')
# 	fyl.write(j_son)
# 	fyl.close