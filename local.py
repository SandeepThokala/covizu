import argparse
import os
import sys
import json
import subprocess
from Bio import Phylo
from datetime import datetime, date
from csv import DictReader

import covizu
from covizu.utils import seq_utils
from covizu.utils.progress_utils import Callback
from batch import *


def parse_args():
    parser = argparse.ArgumentParser(
        description="CoVizu analysis pipeline automation for execution on local files"
    )

    parser.add_argument("infile", type=str,
                        help="input, path to xz-compressed JSON; if not specified, "
                             "download xz file from GISAID provision feed.")

    parser.add_argument("lineages", type=argparse.FileType('r'),
                        help="input, CSV output generated by Pangolin")

    parser.add_argument("-o", "--outfile", type=argparse.FileType('w'),
                        default='data/clusters.{}.json'.format(datetime.now().isoformat().split('.')[0]),
                        help="output, dest for JSON beadplot file")

    parser.add_argument("--bylineage", type=str, default='data/by_lineage.json',
                        help="path to write JSON of features by lineage")

    parser.add_argument('--minlen', type=int, default=29000, help='minimum genome length (nt)')
    parser.add_argument('--mindate', type=str, default='2019-12-01',
                        help='earliest possible sample collection date (ISO format, default '
                             '2019-12-01')
    parser.add_argument('--poisson-cutoff', type=float, default=0.001,
                        help='filtering outlying genomes whose distance exceeds the upper '
                             'quantile of Poisson distribution (molecular clock).  Default 0.001 '
                             'corresponds to 99.9%% cutoff.')

    parser.add_argument('--batchsize', type=int, default=500,
                        help='number of records to batch process with minimap2')

    parser.add_argument("--ref", type=str,
                        default=os.path.join(covizu.__path__[0], "data/NC_045512.fa"),
                        help="path to FASTA file with reference genome")
    parser.add_argument('--mmbin', type=str, default='minimap2',
                        help="path to minimap2 binary executable")
    parser.add_argument('-mmt', "--mmthreads", type=int, default=8,
                        help="number of threads for minimap2.")

    parser.add_argument('--misstol', type=int, default=300,
                        help="maximum tolerated number of missing bases per "
                             "genome (default 300).")
    parser.add_argument("--vcf", type=str,
                        default=os.path.join(covizu.__path__[0], "data/problematic_sites_sarsCov2.vcf"),
                        help="Path to VCF file of problematic sites in SARS-COV-2 genome. "
                             "Source: https://github.com/W-L/ProblematicSites_SARS-CoV2")

    parser.add_argument('--ft2bin', default='fasttree2',
                        help='path to fasttree2 binary executable')

    parser.add_argument('--outdir', default='data/',
                        help='directory to write TreeTime output files')
    parser.add_argument('--ttbin', default='treetime',
                        help='path to treetime binary executable')
    parser.add_argument('--clock', type=float, default=8e-4,
                        help='specify molecular clock rate for '
                             'constraining Treetime analysis (default 8e-4).')

    parser.add_argument('--datetol', type=float, default=0.1,
                        help='exclude tips from time-scaled tree '
                             'with high discordance between estimated and '
                             'known sample collection dates (year units,'
                             'default: 0.1)')

    parser.add_argument('--binpath', type=str, default='rapidnj',
                        help='path to RapidNJ binary executable')
    parser.add_argument('--mincount', type=int, default=500,
                        help='minimum number of variants in lineage '
                             'above which MPI processing will be used.')
    parser.add_argument('--machine_file', type=str, default='mfile',
                        help='path to machine file for MPI.')
    parser.add_argument("-n", "--nboot", type=int, default=100,
                        help="Number of bootstrap samples, default 100.")

    parser.add_argument("--boot-cutoff", type=float, default=0.5,
                        help="Bootstrap cutoff for consensus tree (default 0.5). "
                             "Only used if --cons is specified.")

    return parser.parse_args()


def stream_local(path, lineage_file, minlen=29000, mindate='2019-12-01', callback=None):
    """ Convert local FASTA file to feed-like object - replaces load_gisaid() """
    mindate = seq_utils.fromisoformat(mindate)

    # parse CSV output from Pangolin
    reader = DictReader(lineage_file)
    if reader.fieldnames != ['taxon', 'lineage', 'probability', 'pangoLEARN_version', 'status', 'note']:
        if callback:
            callback("Lineage CSV header does not match expected.", level='ERROR')
        sys.exit()

    lineages = {}
    for row in reader:
        lineages.update({row['taxon']: row['lineage']})

    handle = open(path)
    for header, seq in seq_utils.iter_fasta(handle):
        if len(seq) < minlen:
            continue  # sequence is too short

        # hCoV-19/Canada/Qc-L00240569/2020|EPI_ISL_465679|2020-03-27
        label, accn, coldate = header.split('|')

        if coldate.count('-') != 2:
            continue  # incomplete collection date
        dt = seq_utils.fromisoformat(coldate)
        if dt < mindate or dt > date.today():
            continue  # reject records with non-sensical collection date

        lineage = lineages.get(header, None)
        if lineage is None:
            if callback:
                callback(
                    "Failed to retrieve lineage assignment for {}".format(header),
                    level='ERROR'
                )
            sys.exit()

        record = {
            'covv_virus_name': label,
            'covv_accession_id': accn,
            'sequence': seq,
            'covv_collection_date': coldate,
            'covv_lineage': lineage
        }
        yield record


def process_local(args, callback=None):
    """ Analyze genome sequences from local FASTA file """
    with open(args.ref) as handle:
        reflen = len(seq_utils.convert_fasta(handle)[0][1])

    loader = stream_local(args.infile, args.lineages, minlen=args.minlen,
                          mindate=args.mindate, callback=callback)
    batcher = gisaid_utils.batch_fasta(loader, size=args.batchsize)
    aligned = gisaid_utils.extract_features(batcher, ref_file=args.ref, binpath=args.mmbin,
                                            nthread=args.mmthreads, minlen=args.minlen)
    filtered = gisaid_utils.filter_problematic(aligned, vcf_file=args.vcf, cutoff=args.poisson_cutoff,
                                               callback=callback)
    return gisaid_utils.sort_by_lineage(filtered, callback=callback)


if __name__ == "__main__":
    args = parse_args()
    cb = Callback()

    # check that user has loaded openmpi module
    try:
        subprocess.check_call(['mpirun', '-np', '2', 'ls'], stdout=subprocess.DEVNULL)
    except FileNotFoundError:
        cb.callback("mpirun not loaded - run `module load openmpi/gnu`", level='ERROR')
        sys.exit()

    by_lineage = process_local(args, cb.callback)
    with open(args.bylineage, 'w') as handle:
        # export to file to process large lineages with MPI
        json.dump(by_lineage, handle)

    timetree = build_timetree(by_lineage, args, cb.callback)

    # FIXME: this is fragile, fails if user specifies custom output file name
    head, tail = os.path.split(args.outfile.name)
    timestamp = tail.split('.')[1]
    nwk_file = os.path.join(head, 'timetree.{}.nwk'.format(timestamp))
    with open(nwk_file, 'w') as handle:
        Phylo.write(timetree, file=handle, format='newick')

    result = make_beadplots(by_lineage, args, cb.callback, t0=cb.t0.timestamp())
    args.outfile.write(json.dumps(result))  # serialize results to JSON

    # write data stats
    dbstat_file = os.path.join(head, 'dbstats.{}.json'.format(timestamp))
    with open(dbstat_file, 'w') as handle:
        nseqs = sum([len(rows) for rows in by_lineage.values()])
        val = {'lastupdate': timestamp.split('T')[0], 'noseqs': nseqs}
        json.dump(val, handle)

    cb.callback("All done!")
